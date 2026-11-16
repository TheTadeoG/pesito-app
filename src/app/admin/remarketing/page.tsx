import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminData } from "@/lib/admin-data";
import { lifecycleEmailsEnabled } from "@/lib/lifecycle-send";
import { RemarketingClient, type ContactLog } from "@/app/admin/remarketing/remarketing-client";

export const metadata = { title: "Remarketing" };

const EMAIL_KINDS: { kind: string; name: string; when: string }[] = [
  { kind: "welcome", name: "Bienvenida", when: "Al registrarse" },
  { kind: "add_products", name: "Cargá tus productos", when: "Al día siguiente, sin productos" },
  { kind: "first_sale", name: "Tu primera venta", when: "A los 3 días, con productos y sin ventas" },
  { kind: "trial_ending", name: "Te quedan 3 días de Pro", when: "3 días antes de que termine la prueba" },
  { kind: "trial_ended", name: "Terminó tu prueba", when: "Hasta 5 días después" },
];

export default async function AdminRemarketingPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { orgs } = await loadAdminData();

  const [contactsRes, emailsRes] = await Promise.all([
    admin.from("admin_contacts").select("org_id, kind, audience, days, created_at").order("created_at", { ascending: false }).limit(1000),
    admin.from("lifecycle_emails").select("kind"),
  ]);
  const contacts = contactsRes.data ?? [];
  const nameById = new Map(orgs.map((o) => [o.id, o.name]));

  const lastByOrg: Record<string, { at: string; kind: string }> = {};
  for (const c of contacts) {
    if (c.kind === "prueba") continue;
    if (!lastByOrg[c.org_id]) lastByOrg[c.org_id] = { at: c.created_at, kind: c.kind };
  }

  // Pruebas regaladas: cuántas, a cuántos negocios y cuántos de ellos terminaron pagando.
  const gifts = contacts.filter((c) => c.kind === "prueba");
  const giftedOrgs = new Set(gifts.map((g) => g.org_id));
  const paidById = new Map(orgs.map((o) => [o.id, o.paidViaMp && !o.internal && o.plan !== "gratis"]));
  const converted = [...giftedOrgs].filter((id) => paidById.get(id)).length;
  // eslint-disable-next-line react-hooks/purity -- Server Component: se calcula fresco en cada request.
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const log: ContactLog[] = contacts.slice(0, 8).map((c) => ({
    at: c.created_at,
    who: nameById.get(c.org_id) ?? "Un negocio",
    what: c.kind === "prueba" ? `Se le regalaron ${c.days ?? ""} días de prueba` : c.kind === "whatsapp" ? "Se le escribió por WhatsApp" : "Se le mandó un mail",
  }));

  const sent = new Map<string, number>();
  for (const e of emailsRes.data ?? []) sent.set(e.kind, (sent.get(e.kind) ?? 0) + 1);

  return (
    <RemarketingClient
      initialOrgs={orgs}
      now={now}
      lastContacts={lastByOrg}
      log={log}
      giftStats={{ last30: gifts.filter((g) => new Date(g.created_at).getTime() >= monthAgo).length, orgs: giftedOrgs.size, converted }}
      emails={{ enabled: lifecycleEmailsEnabled(), kinds: EMAIL_KINDS.map((k) => ({ ...k, sent: sent.get(k.kind) ?? 0 })) }}
      contactsAvailable={!contactsRes.error}
    />
  );
}
