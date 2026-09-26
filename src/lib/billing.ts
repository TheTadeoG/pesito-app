import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelPreapproval,
  getAuthorizedPayment,
  getPreapproval,
  type AuthorizedPayment,
  type Preapproval,
} from "@/lib/mercadopago";
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
  await admin.from("billing_events").insert({
    org_id: orgId,
    topic,
    mp_id: mpId,
    status,
    amount,
    detail: detail as Json,
  });
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
  const ref = parseExternalReference(pre.external_reference);
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
    await admin.from("organization_subscriptions").upsert(
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
    ref = parseExternalReference((await getPreapproval(ap.preapproval_id)).external_reference);
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
