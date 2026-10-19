import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { pickEmail, type OrgLifecycleState } from "@/lib/lifecycle";
import { sendLifecycle } from "@/lib/lifecycle-send";

// Correos automáticos del ciclo de vida: la llama Vercel Cron una vez por día (vercel.json) con
// "Authorization: Bearer $CRON_SECRET". Decide qué le toca a cada negocio nuevo (lib/lifecycle.ts)
// y lo manda. Sin CRON_SECRET o con otro valor, no hace nada.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;
const MAX_SENDS_PER_RUN = 60;
const PAUSE_MS = 600; // Resend acepta ~2 pedidos por segundo

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();
  const now = Date.now();

  const [orgs, activity, subs, owners, sentRows, optouts] = await Promise.all([
    fetchAll((from, to) => admin.from("organizations").select("id, name, created_at").order("id").range(from, to)),
    fetchAll((from, to) => admin.from("platform_org_activity").select("org_id, product_count, sale_count").order("org_id").range(from, to)),
    fetchAll((from, to) =>
      admin
        .from("organization_subscriptions")
        .select("org_id, plan, pro_trial_ends_at, mp_preapproval_id, payment_status, grace_until")
        .order("org_id")
        .range(from, to)
    ),
    fetchAll((from, to) => admin.from("memberships").select("id, org_id, email").eq("role", "owner").not("email", "is", null).order("id").range(from, to)),
    fetchAll((from, to) => admin.from("lifecycle_emails").select("id, org_id, kind, sent_at").order("id").range(from, to)),
    fetchAll((from, to) => admin.from("lifecycle_optout").select("org_id").order("org_id").range(from, to)),
  ]);

  const activityByOrg = new Map(activity.map((a) => [a.org_id, a]));
  const subByOrg = new Map(subs.map((s) => [s.org_id, s]));
  const ownerByOrg = new Map<string, string>();
  for (const o of owners) if (o.email && !ownerByOrg.has(o.org_id)) ownerByOrg.set(o.org_id, o.email);
  const sentByOrg = new Map<string, { kind: string; sentAt: string }[]>();
  for (const s of sentRows) sentByOrg.set(s.org_id, [...(sentByOrg.get(s.org_id) ?? []), { kind: s.kind, sentAt: s.sent_at }]);
  const optedOut = new Set(optouts.map((o) => o.org_id));

  const sentCounts: Record<string, number> = {};
  let considered = 0;
  let sends = 0;
  for (const org of orgs) {
    const sub = subByOrg.get(org.id);
    const young = now - new Date(org.created_at).getTime() <= 45 * DAY;
    if (!young && sub?.payment_status !== "past_due") continue; // sólo negocios nuevos o con un cobro fallido
    considered += 1;
    const act = activityByOrg.get(org.id);
    const state: OrgLifecycleState = {
      createdAt: org.created_at,
      productCount: Number(act?.product_count ?? 0),
      saleCount: Number(act?.sale_count ?? 0),
      plan: sub?.plan ?? "gratis",
      trialEndsAt: sub?.pro_trial_ends_at ?? null,
      // Un plan asignado a mano desde el panel no tiene suscripción ni pago de Mercado Pago.
      paidViaMp: (sub?.plan ?? "gratis") !== "gratis" && Boolean(sub?.mp_preapproval_id || sub?.payment_status),
      paymentStatus: sub?.payment_status ?? null,
      ownerEmail: ownerByOrg.get(org.id) ?? null,
      optedOut: optedOut.has(org.id),
      sent: sentByOrg.get(org.id) ?? [],
    };
    const pick = pickEmail(state, now);
    if (!pick || !state.ownerEmail) continue;
    if (sends >= MAX_SENDS_PER_RUN) break; // el resto sale mañana
    const ok = await sendLifecycle(admin, {
      orgId: org.id,
      orgName: org.name,
      ownerEmail: state.ownerEmail,
      pick,
      trialEndsAt: state.trialEndsAt,
      graceUntil: sub?.grace_until ?? null,
    });
    if (ok) {
      sends += 1;
      sentCounts[pick.template] = (sentCounts[pick.template] ?? 0) + 1;
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }
  return NextResponse.json({ considered, sent: sends, byTemplate: sentCounts });
}
