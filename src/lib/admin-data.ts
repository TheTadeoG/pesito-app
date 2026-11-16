import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { businessTypes } from "@/lib/business-types";
import type { AdminOrg } from "@/lib/admin-shared";

export { DAY_MS, SEGMENTS, ago, inSegment, whatsappNumber, type AdminOrg, type SegmentId } from "@/lib/admin-shared";

// Datos de cada negocio para el panel interno (Resumen y Negocios): una fila por negocio con quién es el dueño,
// cómo contactarlo, en qué plan está y qué hizo. Sólo servidor: usa la service role.

const typeLabels: Record<string, string> = Object.fromEntries(businessTypes.map((t) => [t.value, t.label]));

export interface AdminData {
  orgs: AdminOrg[];
  /** Cuentas registradas que todavía no crearon su negocio. */
  signedUpWithoutOrg: number;
  totalUsers: number;
  /** Se pudo leer la vista de actividad (migración 0075/0091). */
  hasActivity: boolean;
  hasLastSale: boolean;
}

export async function loadAdminData(): Promise<AdminData> {
  const admin = createAdminClient();

  const [orgsRaw, subsRaw, activityRes, memberships] = await Promise.all([
    fetchAll((from, to) => admin.from("organizations").select("id, name, business_type, created_at, phone").order("created_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => admin.from("organization_subscriptions").select("*").order("org_id").range(from, to)),
    admin.from("platform_org_activity").select("*"),
    fetchAll((from, to) => admin.from("memberships").select("user_id, org_id, role").order("id").range(from, to)),
  ]);

  // auth.users sólo se lee con la Admin API, paginando.
  const users: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; name: string | null }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    users.push(
      ...data.users.map((u) => {
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        const first = typeof meta.first_name === "string" ? meta.first_name : "";
        const last = typeof meta.last_name === "string" ? meta.last_name : "";
        const full = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : "";
        return {
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          name: `${first} ${last}`.trim() || full || null,
        };
      })
    );
    if (!data.nextPage) break;
  }
  const userById = new Map(users.map((u) => [u.id, u]));
  const ownerByOrg = new Map<string, string>();
  const withOrg = new Set<string>();
  for (const m of memberships) {
    withOrg.add(m.user_id);
    if (m.role === "owner" && !ownerByOrg.has(m.org_id)) ownerByOrg.set(m.org_id, m.user_id);
  }

  const subByOrg = new Map(subsRaw.map((s) => [s.org_id, s]));
  const activityRows = (activityRes.data ?? []) as {
    org_id: string;
    product_count: number | string;
    sale_count: number | string;
    first_sale_at: string | null;
    last_sale_at?: string | null;
    member_count: number | string;
  }[];
  const activityByOrg = new Map(activityRows.map((a) => [a.org_id, a]));

  const orgs: AdminOrg[] = orgsRaw.map((o) => {
    const sub = subByOrg.get(o.id);
    const act = activityByOrg.get(o.id);
    const owner = userById.get(ownerByOrg.get(o.id) ?? "");
    const plan = sub?.plan ?? "gratis";
    return {
      id: o.id,
      name: o.name,
      type: typeLabels[o.business_type] ?? o.business_type ?? "Otro",
      createdAt: o.created_at,
      plan,
      trialEndsAt: sub?.pro_trial_ends_at ?? null,
      paidViaMp: plan !== "gratis" && Boolean(sub?.mp_preapproval_id || sub?.payment_status),
      paymentStatus: sub?.payment_status ?? null,
      cycle: sub?.billing_cycle ?? null,
      invoicePack: Number((sub as { invoice_pack?: number } | undefined)?.invoice_pack ?? 0),
      productCount: Number(act?.product_count ?? 0),
      saleCount: Number(act?.sale_count ?? 0),
      firstSaleAt: act?.first_sale_at ?? null,
      lastSaleAt: act?.last_sale_at ?? act?.first_sale_at ?? null,
      memberCount: Number(act?.member_count ?? 1),
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      phone: o.phone ?? null,
      lastSignIn: owner?.last_sign_in_at ?? null,
    };
  });

  return {
    orgs,
    signedUpWithoutOrg: users.filter((u) => !withOrg.has(u.id)).length,
    totalUsers: users.length,
    hasActivity: !activityRes.error,
    hasLastSale: activityRows.length > 0 && "last_sale_at" in activityRows[0],
  };
}

