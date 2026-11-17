"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { planLabels, type Plan } from "@/lib/subscription";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import { paymentLabels } from "@/lib/payment-labels";

export interface OrgNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface TimelineEvent {
  at: string;
  what: string;
}

export interface OrgProfile {
  /** Lo más vendido en sus últimas ventas (producto y unidades). */
  topProducts: { name: string; units: number }[];
  /** Algunos productos cargados (se usa cuando todavía no vendió). */
  recentProducts: string[];
  topBrands: { name: string; count: number }[];
  suppliers: string[];
  paymentMix: { label: string; pct: number }[];
  avgTicket: number | null;
  /** Cuántas ventas se miraron para el ticket promedio y los medios de pago. */
  salesSampled: number;
  branches: number;
  debtors: number;
}

export interface OrgDetail {
  usage: { label: string; value: string }[];
  timeline: TimelineEvent[];
  notes: OrgNote[];
  /** A qué se dedica: qué vende, con qué marcas y proveedores trabaja, cómo le pagan. */
  profile: OrgProfile;
  /** Las notas no se pueden leer ni guardar hasta aplicar la migración 0091. */
  notesAvailable: boolean;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

async function loadProfile(orgId: string): Promise<OrgProfile> {
  const admin = createAdminClient();
  const [recentSales, brandsRaw, suppliersRes, recentProducts, branchesRes, debtorsRes] = await Promise.all([
    admin.from("sales").select("id, total, payment_method").eq("org_id", orgId).eq("status", "completada").order("created_at", { ascending: false }).limit(150),
    fetchAll((from, to) => admin.from("products").select("id, brand").eq("org_id", orgId).not("brand", "is", null).order("id").range(from, to)),
    admin.from("suppliers").select("name").eq("org_id", orgId).order("created_at").limit(8),
    admin.from("products").select("name").eq("org_id", orgId).order("created_at", { ascending: false }).limit(12),
    admin.from("branches").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgId).gt("balance", 0),
  ]);

  const sales = recentSales.data ?? [];
  // Lo más vendido: las unidades de cada producto en esas últimas ventas.
  const items = await fetchAllIn(
    sales.map((x) => x.id),
    (ids, from, to) => admin.from("sale_items").select("id, product_name, quantity").in("sale_id", ids).order("id").range(from, to)
  );
  const units = new Map<string, number>();
  for (const it of items) units.set(it.product_name, (units.get(it.product_name) ?? 0) + Number(it.quantity));

  const brandCount = new Map<string, number>();
  for (const b of brandsRaw) if (b.brand) brandCount.set(b.brand, (brandCount.get(b.brand) ?? 0) + 1);

  const mix = new Map<string, number>();
  for (const x of sales) mix.set(x.payment_method, (mix.get(x.payment_method) ?? 0) + 1);

  return {
    topProducts: [...units.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, u]) => ({ name, units: Math.round(u * 100) / 100 })),
    recentProducts: (recentProducts.data ?? []).map((p) => p.name),
    topBrands: [...brandCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
    suppliers: (suppliersRes.data ?? []).map((x) => x.name),
    paymentMix: [...mix.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([method, n]) => ({ label: paymentLabels[method] ?? method, pct: Math.round((n / sales.length) * 100) })),
    avgTicket: sales.length > 0 ? sales.reduce((sum, x) => sum + Number(x.total), 0) / sales.length : null,
    salesSampled: sales.length,
    branches: branchesRes.count ?? 0,
    debtors: debtorsRes.count ?? 0,
  };
}

/** Ficha de un negocio: qué usa, qué hizo últimamente y las notas del equipo. Se pide al elegirlo en la lista. */
export async function getOrgDetail(orgId: string): Promise<OrgDetail> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const head = { count: "exact" as const, head: true };

  const [
    { count: products },
    { count: sales },
    { count: customers },
    { count: suppliers },
    { count: openRegisters },
    { count: invoices },
    { data: members },
    { data: lastSales },
    { data: firstProduct },
    { data: registers },
    { data: history },
    { data: events },
    { data: emails },
    { data: org },
    notesRes,
    profile,
  ] = await Promise.all([
    admin.from("products").select("id", head).eq("org_id", orgId),
    admin.from("sales").select("id", head).eq("org_id", orgId).eq("status", "completada"),
    admin.from("customers").select("id", head).eq("org_id", orgId),
    admin.from("suppliers").select("id", head).eq("org_id", orgId),
    admin.from("cash_registers").select("id", head).eq("org_id", orgId).eq("status", "abierta"),
    admin.from("arca_vouchers").select("id", head).eq("org_id", orgId).eq("status", "authorized").eq("environment", "production"),
    admin.from("memberships").select("id").eq("org_id", orgId),
    admin.from("sales").select("total, payment_method, created_at").eq("org_id", orgId).eq("status", "completada").order("created_at", { ascending: false }).limit(3),
    admin.from("products").select("created_at").eq("org_id", orgId).order("created_at").limit(1),
    admin.from("cash_registers").select("opened_at, status").eq("org_id", orgId).order("opened_at", { ascending: false }).limit(2),
    admin.from("plan_history").select("from_plan, to_plan, created_at, changed_by").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
    admin.from("billing_events").select("topic, status, amount, created_at").eq("org_id", orgId).in("topic", ["checkout_done", "payment_applied", "subscription_authorized_payment"]).order("created_at", { ascending: false }).limit(5),
    admin.from("lifecycle_emails").select("kind, sent_at").eq("org_id", orgId).order("sent_at", { ascending: false }).limit(5),
    admin.from("organizations").select("created_at").eq("id", orgId).maybeSingle(),
    admin.from("admin_org_notes").select("id, body, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(30),
    loadProfile(orgId),
  ]);

  const timeline: TimelineEvent[] = [];
  for (const s of lastSales ?? []) timeline.push({ at: s.created_at, what: `Hizo una venta de ${money(Number(s.total))}` });
  for (const r of registers ?? []) timeline.push({ at: r.opened_at, what: r.status === "abierta" ? "Abrió la caja" : "Abrió una caja (ya cerrada)" });
  if (firstProduct?.[0]) timeline.push({ at: firstProduct[0].created_at, what: "Cargó su primer producto" });
  for (const h of history ?? []) {
    timeline.push({
      at: h.created_at,
      what: `Pasó de ${planLabels[h.from_plan as Plan] ?? h.from_plan} a ${planLabels[h.to_plan as Plan] ?? h.to_plan}${h.changed_by ? " (a mano, desde el panel)" : ""}`,
    });
  }
  for (const e of events ?? []) {
    if (e.status === "rejected" || e.status === "failed") timeline.push({ at: e.created_at, what: "Falló un cobro del plan" });
    else if (e.topic === "checkout_done" || e.topic === "payment_applied") timeline.push({ at: e.created_at, what: `Pagó el plan${e.amount ? ` (${money(Number(e.amount))})` : ""}` });
  }
  for (const m of emails ?? []) timeline.push({ at: m.sent_at, what: `Se le mandó el correo “${m.kind}”` });
  if (org?.created_at) timeline.push({ at: org.created_at, what: "Creó el negocio" });

  return {
    usage: [
      { label: "productos", value: String(products ?? 0) },
      { label: "ventas", value: String(sales ?? 0) },
      { label: "usuarios", value: String(members?.length ?? 0) },
      { label: "cajas abiertas", value: String(openRegisters ?? 0) },
      { label: "clientes", value: String(customers ?? 0) },
      { label: "proveedores", value: String(suppliers ?? 0) },
      { label: "facturas", value: String(invoices ?? 0) },
    ],
    timeline: timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10),
    profile,
    notes: (notesRes.data ?? []).map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at })),
    notesAvailable: !notesRes.error,
  };
}

/** Anota algo del negocio (con quién se habló, qué se acordó). */
export async function addOrgNote(orgId: string, body: string): Promise<{ note?: OrgNote; error?: string }> {
  const { userId } = await requirePlatformAdmin();
  const text = body.trim().slice(0, 2000);
  if (!text) return { error: "Escribí la nota." };
  const { data, error } = await createAdminClient().from("admin_org_notes").insert({ org_id: orgId, author_id: userId, body: text }).select("id, body, created_at").single();
  if (error || !data) return { error: "No pudimos guardar la nota (¿falta aplicar la migración 0091?)." };
  return { note: { id: data.id, body: data.body, createdAt: data.created_at } };
}

/**
 * Regala días de prueba Pro a un negocio que está en el plan gratis: suma a lo que le quede (o desde hoy si ya
 * venció). No cobra nada y queda anotado en las notas, con quién lo dio.
 */
export async function giveTrialDays(orgId: string, days: number, audience?: string): Promise<{ trialEndsAt?: string; note?: OrgNote; error?: string }> {
  const { userId } = await requirePlatformAdmin();
  if (![7, 14, 30].includes(days)) return { error: "Elegí 7, 14 o 30 días." };
  const admin = createAdminClient();
  const { data: sub } = await admin.from("organization_subscriptions").select("plan, pro_trial_ends_at").eq("org_id", orgId).maybeSingle();
  if ((sub?.plan ?? "gratis") !== "gratis") return { error: "Este negocio ya tiene un plan pago: no hace falta una prueba." };

  const now = Date.now();
  const current = sub?.pro_trial_ends_at ? new Date(sub.pro_trial_ends_at).getTime() : 0;
  const trialEndsAt = new Date(Math.max(now, current) + days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("organization_subscriptions").upsert({ org_id: orgId, plan: "gratis", pro_trial_ends_at: trialEndsAt }, { onConflict: "org_id" });
  if (error) return { error: "No pudimos guardar los días de prueba." };

  const { data: note } = await admin
    .from("admin_org_notes")
    .insert({ org_id: orgId, author_id: userId, body: `Se regalaron ${days} días de prueba Pro (hasta el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(trialEndsAt))}).` })
    .select("id, body, created_at")
    .single();
  // Para medir cuántas pruebas regaladas terminan en un pago (panel de remarketing; sin la migración 0092 no se anota).
  await admin.from("admin_contacts").insert({ org_id: orgId, kind: "prueba", audience: audience ?? null, days, author_id: userId });
  revalidatePath("/admin", "layout");
  return { trialEndsAt, note: note ? { id: note.id, body: note.body, createdAt: note.created_at } : undefined };
}

/** Marca (o desmarca) un negocio como cuenta propia o de prueba: deja de contar como cliente que paga. Migración 0095. */
export async function setOrgInternal(orgId: string, internal: boolean): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const table = admin.from("admin_internal_orgs" as never);
  const { error } = internal
    ? await table.upsert({ org_id: orgId } as never, { onConflict: "org_id" })
    : await table.delete().eq("org_id", orgId);
  if (error) return { error: "No pudimos guardar el cambio. ¿Está aplicada la migración 0095?" };
  revalidatePath("/admin");
  revalidatePath("/admin/negocios");
  return {};
}
