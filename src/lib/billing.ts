import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelPreapproval,
  getAuthorizedPayment,
  getPreapproval,
  getPreapprovalPlan,
  searchPreapprovalsByPlan,
  type AuthorizedPayment,
  type Preapproval,
} from "@/lib/mercadopago";
import { mercadoPagoConfigured, MercadoPagoError } from "@/lib/mercadopago";
import { ANNUAL_DISCOUNT, planDefinitions } from "@/lib/plan-features";
import type { BillingCycle, Plan } from "@/lib/subscription";
import type { Json } from "@/lib/database.types";

// Estado del cobro de los planes a partir de lo que dice Mercado Pago
// (migración 0047). Siempre se consulta la API con nuestro token antes de
// tocar nada: un aviso sólo dice "mirá tal suscripción", no se le cree el
// contenido. Escribe con la service role (la tabla no tiene políticas de
// escritura para los usuarios).

export const GRACE_DAYS = 7;
const PAID_PLANS: Plan[] = ["esencial", "pro", "ia"];

/** Monto de cada cobro: el mensual, o 12 meses con el descuento anual. */
export function chargeAmount(plan: Plan, cycle: BillingCycle): number {
  const monthly = planDefinitions[plan].price;
  return cycle === "anual" ? Math.round(monthly * (1 - ANNUAL_DISCOUNT)) * 12 : monthly;
}

/** "<org_id>|<plan>|<ciclo>" — lo que viaja en external_reference. */
export function buildExternalReference(orgId: string, plan: Plan, cycle: BillingCycle): string {
  return `${orgId}|${plan}|${cycle}`;
}

export function parseExternalReference(
  ref: string | null | undefined
): { orgId: string; plan: Plan; cycle: BillingCycle } | null {
  if (!ref) return null;
  const [orgId, plan, cycle] = String(ref).split("|");
  if (!/^[0-9a-f-]{36}$/i.test(orgId ?? "")) return null;
  if (!PAID_PLANS.includes(plan as Plan)) return null;
  if (cycle !== "mensual" && cycle !== "anual") return null;
  return { orgId, plan: plan as Plan, cycle };
}

/**
 * De qué negocio/plan/ciclo es una suscripción: la external_reference viene
 * en la suscripción o, si se pagó desde el checkout de un plan, en el plan.
 */
export async function referenceOf(pre: Preapproval) {
  const direct = parseExternalReference(pre.external_reference);
  if (direct || !pre.preapproval_plan_id) return direct;
  return parseExternalReference((await getPreapprovalPlan(pre.preapproval_plan_id)).external_reference);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function logEvent(
  orgId: string | null,
  topic: string,
  mpId: string,
  status: string | null,
  amount: number | null,
  detail: unknown
) {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_events").insert({
    org_id: orgId,
    topic,
    mp_id: mpId,
    status,
    amount,
    detail: detail as Json,
  });
  if (error) console.error("billing_events", error.message);
}

/**
 * Aplica el estado de una suscripción de Mercado Pago:
 * - authorized: el plan queda activo (y se da de baja la suscripción
 *   anterior si era un cambio de plan).
 * - cancelled: sigue el plan hasta el fin del período pago y después Gratis.
 * - paused: como un cobro fallido (gracia de 7 días).
 * - pending: todavía no cargó el medio de pago; no cambia nada.
 */
export async function applyPreapproval(pre: Preapproval): Promise<string | null> {
  const ref = await referenceOf(pre);
  if (!ref) return null;
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("org_id", ref.orgId)
    .maybeSingle();

  await logEvent(ref.orgId, "subscription_preapproval", pre.id, pre.status, pre.auto_recurring?.transaction_amount ?? null, pre);

  const isCurrent = !current?.mp_preapproval_id || current.mp_preapproval_id === pre.id;

  if (pre.status === "authorized") {
    const previousId = current?.mp_preapproval_id && current.mp_preapproval_id !== pre.id ? current.mp_preapproval_id : null;
    const periodEnd =
      pre.next_payment_date ?? addMonths(new Date(), ref.cycle === "anual" ? 12 : 1).toISOString();
    const { error } = await admin.from("organization_subscriptions").upsert(
      {
        org_id: ref.orgId,
        plan: ref.plan,
        billing_cycle: ref.cycle,
        mp_preapproval_id: pre.id,
        payment_status:
          current?.mp_preapproval_id === pre.id && current.payment_status === "past_due" ? "past_due" : "active",
        current_period_end: periodEnd,
        grace_until: current?.mp_preapproval_id === pre.id ? current.grace_until ?? null : null,
        payer_email: pre.payer_email ?? current?.payer_email ?? null,
        pro_trial_ends_at: null,
      },
      { onConflict: "org_id" }
    );
    if (error) {
      // Sin la migración 0047 no existen las columnas del cobro.
      console.error("applyPreapproval", error.message);
      throw new Error(`No pudimos guardar el plan: ${error.message}`);
    }
    if ((current?.plan ?? "gratis") !== ref.plan) {
      await admin.from("plan_history").insert({
        org_id: ref.orgId,
        from_plan: current?.plan ?? "gratis",
        to_plan: ref.plan,
        changed_by: null,
      });
    }
    // Cambio de plan: la suscripción vieja deja de cobrarse.
    if (previousId) {
      await cancelPreapproval(previousId).catch((e) => console.error("No pudimos cancelar la suscripción anterior", e));
    }
    return ref.orgId;
  }

  if (!isCurrent) return ref.orgId; // aviso de una suscripción vieja: se ignora

  if (pre.status === "cancelled" || pre.status === "canceled") {
    await admin
      .from("organization_subscriptions")
      .update({
        payment_status: "cancelled",
        current_period_end: current?.current_period_end ?? new Date().toISOString(),
      })
      .eq("org_id", ref.orgId);
  } else if (pre.status === "paused") {
    await admin
      .from("organization_subscriptions")
      .update({
        payment_status: "past_due",
        grace_until: current?.grace_until ?? addDays(new Date(), GRACE_DAYS).toISOString(),
      })
      .eq("org_id", ref.orgId);
  }
  return ref.orgId;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Aplica un cobro de la suscripción: aprobado → al día hasta el próximo
 * cobro; rechazado → gracia de 7 días (Mercado Pago reintenta mientras
 * tanto); al vencer la gracia el negocio funciona como Gratis (lo decide
 * org_effective_plan, sin tarea programada).
 */
export async function applyAuthorizedPayment(ap: AuthorizedPayment): Promise<string | null> {
  const admin = createAdminClient();
  let ref = parseExternalReference(ap.external_reference);
  if (!ref && ap.preapproval_id) {
    ref = await referenceOf(await getPreapproval(ap.preapproval_id));
  }
  if (!ref) return null;

  const { data: current } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("org_id", ref.orgId)
    .maybeSingle();

  const paymentStatus = ap.payment?.status ?? null;
  await logEvent(ref.orgId, "subscription_authorized_payment", String(ap.id), paymentStatus ?? ap.status, Number(ap.transaction_amount) || null, ap);

  if (current?.mp_preapproval_id && current.mp_preapproval_id !== ap.preapproval_id) return ref.orgId;

  if (paymentStatus === "approved") {
    const base = ap.debit_date ? new Date(ap.debit_date) : new Date();
    await admin
      .from("organization_subscriptions")
      .update({
        payment_status: current?.payment_status === "cancelled" ? "cancelled" : "active",
        grace_until: null,
        current_period_end: addMonths(base, ref.cycle === "anual" ? 12 : 1).toISOString(),
      })
      .eq("org_id", ref.orgId);
  } else if (paymentStatus === "rejected" || paymentStatus === "cancelled" || paymentStatus === "canceled") {
    await admin
      .from("organization_subscriptions")
      .update({
        payment_status: "past_due",
        grace_until: current?.grace_until ?? addDays(new Date(), GRACE_DAYS).toISOString(),
      })
      .eq("org_id", ref.orgId);
  }
  return ref.orgId;
}

/** Trae el recurso de Mercado Pago y lo aplica. */
export async function syncFromMercadoPago(topic: string, id: string): Promise<string | null> {
  if (topic === "subscription_preapproval" || topic === "preapproval") {
    return applyPreapproval(await getPreapproval(id));
  }
  if (topic === "subscription_authorized_payment" || topic === "authorized_payment") {
    return applyAuthorizedPayment(await getAuthorizedPayment(id));
  }
  return null;
}

const CHECKOUT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Anota un checkout abierto (el plan de Mercado Pago) para buscar después su pago. */
export async function recordCheckout(orgId: string, checkoutId: string, plan: Plan, cycle: BillingCycle) {
  await logEvent(orgId, "checkout", checkoutId, "pending", chargeAmount(plan, cycle), { plan, cycle });
}

/** Si el checkout se pagó, aplica la suscripción. true = pagado. */
async function applyCheckoutIfPaid(orgId: string, checkoutId: string): Promise<boolean> {
  const found = await searchPreapprovalsByPlan(checkoutId);
  const paid = found.find((p) => p.status === "authorized");
  if (!paid || (await referenceOf(paid))?.orgId !== orgId) return false;
  await applyPreapproval(paid);
  await logEvent(orgId, "checkout_done", checkoutId, "authorized", null, { preapproval_id: paid.id });
  return true;
}

async function checkoutEvents(orgId: string) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - CHECKOUT_WINDOW_MS).toISOString();
  const { data } = await admin
    .from("billing_events")
    .select("topic, mp_id")
    .eq("org_id", orgId)
    .in("topic", ["checkout", "checkout_done"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  const events = data ?? [];
  const done = new Set(events.filter((e) => e.topic === "checkout_done").map((e) => e.mp_id));
  const opened = new Set(events.filter((e) => e.topic === "checkout").map((e) => e.mp_id));
  return { done, opened };
}

/**
 * Busca en Mercado Pago si se pagó alguno de los checkouts abiertos en los
 * últimos días y lo aplica. Así el plan se activa aunque Mercado Pago no
 * vuelva a Pesito con el id ni llegue el aviso (webhook).
 */
export async function syncPendingCheckouts(orgId: string): Promise<void> {
  const { done, opened } = await checkoutEvents(orgId);
  const pending = [...opened].filter((id) => !done.has(id)).slice(0, 3);
  for (const checkoutId of pending) await applyCheckoutIfPaid(orgId, checkoutId);
}

/**
 * ¿Se pagó este checkout puntual? (el que se abrió desde la pantalla). Sólo
 * mira checkouts de este negocio. Un plan que ya se tenía no cuenta.
 */
export async function isCheckoutPaid(orgId: string, checkoutId: string): Promise<boolean> {
  const { done, opened } = await checkoutEvents(orgId);
  if (done.has(checkoutId)) return true;
  if (!opened.has(checkoutId)) return false;
  return applyCheckoutIfPaid(orgId, checkoutId);
}

/**
 * Al volver de Mercado Pago: con ?preapproval_id se aplica esa suscripción
 * (sólo si es de este negocio); además se buscan los checkouts pagados, porque
 * Mercado Pago no siempre vuelve con el id. Sólo servidor (no es una acción).
 */
export async function syncReturnedPayment(orgId: string, preapprovalId?: string): Promise<void> {
  if (!mercadoPagoConfigured()) return;
  try {
    if (preapprovalId && /^[0-9a-zA-Z_-]{8,64}$/.test(preapprovalId)) {
      const pre = await getPreapproval(preapprovalId);
      if ((await referenceOf(pre))?.orgId === orgId) await applyPreapproval(pre);
    }
    await syncPendingCheckouts(orgId);
  } catch (e) {
    console.error("syncReturnedPayment", e instanceof MercadoPagoError ? e.body : e);
  }
}
