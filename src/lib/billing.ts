import { normalizePlanParam } from "@/lib/plan-ids";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelPreapproval,
  getAuthorizedPayment,
  getPreapproval,
  getPayment,
  getPreapprovalPlan,
  searchAuthorizedPayments,
  searchPaymentsByReference,
  searchPreapprovalsByPlan,
  updatePreapprovalAmount,
  type Payment,
  type AuthorizedPayment,
  type Preapproval,
} from "@/lib/mercadopago";
import { mercadoPagoConfigured, MercadoPagoError } from "@/lib/mercadopago";
import { ANNUAL_DISCOUNT, planDefinitions } from "@/lib/plan-features";
import { isValidPack, packPrice } from "@/lib/invoice-packs";
import { lapsedToFree, planOrder, PLAN_GRACE_DAYS, type BillingCycle, type Plan, type SubscriptionInfo } from "@/lib/subscription";
import type { Database, Json } from "@/lib/database.types";

// Estado del cobro de los planes a partir de lo que dice Mercado Pago
// (migración 0047). Siempre se consulta la API con nuestro token antes de
// tocar nada: un aviso sólo dice "mirá tal suscripción", no se le cree el
// contenido. Escribe con la service role (la tabla no tiene políticas de
// escritura para los usuarios).

export const GRACE_DAYS = 7;
const PAID_PLANS: Plan[] = ["basico", "pro", "max"];

/** Monto de cada cobro: el mensual, o 12 meses con el descuento anual. El paquete de facturas (por mes) va incluido. */
export function chargeAmount(plan: Plan, cycle: BillingCycle, pack = 0): number {
  const monthly = planDefinitions[plan].price + packPrice(pack);
  return cycle === "anual" ? Math.round(monthly * (1 - ANNUAL_DISCOUNT)) * 12 : monthly;
}

/**
 * Monto del primer cobro: con la promo de lanzamiento (primer mes, sólo
 * mensual y sólo para quien nunca pagó un plan), el precio promocional.
 */
export function firstChargeAmount(plan: Plan, cycle: BillingCycle, promoEligible: boolean, pack = 0): number {
  const promo = planDefinitions[plan].promoPrice;
  return promoEligible && cycle === "mensual" && promo ? promo + packPrice(pack) : chargeAmount(plan, cycle, pack);
}

/** ¿El negocio nunca pagó un plan? (la promo del primer mes es sólo para él). */
export async function isPromoEligible(orgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ count: paid }, { data: sub }] = await Promise.all([
    admin
      .from("billing_events")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("topic", ["checkout_done", "payment_applied"]),
    admin.from("organization_subscriptions").select("*").eq("org_id", orgId).maybeSingle(),
  ]);
  if ((paid ?? 0) > 0) return false;
  // Ya tiene (o tuvo) una suscripción o un plan pago asignado.
  return !sub?.mp_preapproval_id && (sub?.plan ?? "gratis") === "gratis";
}

/** "<org_id>|<plan>|<ciclo>[|k<paquete>]" — lo que viaja en external_reference. */
export function buildExternalReference(orgId: string, plan: Plan, cycle: BillingCycle, pack = 0): string {
  return `${orgId}|${plan}|${cycle}${pack > 0 ? `|k${pack}` : ""}`;
}

/**
 * Lee la external_reference. Los pagos únicos llevan un cuarto campo
 * ("u<id>") para poder buscar ese pago puntual.
 */
export function parseExternalReference(
  ref: string | null | undefined
): { orgId: string; plan: Plan; cycle: BillingCycle; oneTime: boolean; pack: number; addonAmount: number | null } | null {
  if (!ref) return null;
  const [orgId, rawPlan, cycle, ...tags] = String(ref).split("|");
  const packTag = tags.find((t) => /^k\d+$/.test(t));
  const pack = packTag ? Number(packTag.slice(1)) : 0;
  if (!isValidPack(pack)) return null;
  // Pago aparte del paquete sobre un débito ya activo: "a<monto>_<azar>".
  const addonTag = tags.find((t) => /^a\d+_/.test(t));
  const addonAmount = addonTag ? Number(addonTag.slice(1).split("_")[0]) : null;
  const plan = normalizePlanParam(rawPlan); // referencias de antes del cambio de nombres (esencial/ia)
  if (!/^[0-9a-f-]{36}$/i.test(orgId ?? "")) return null;
  if (!PAID_PLANS.includes(plan as Plan)) return null;
  if (cycle !== "mensual" && cycle !== "anual") return null;
  return { orgId, plan: plan as Plan, cycle, oneTime: tags.some((t) => t.startsWith("u")), pack, addonAmount };
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

type SubscriptionRow = Database["public"]["Tables"]["organization_subscriptions"]["Row"];

/**
 * Período de gracia al pasar a un plan más barato (0048): 7 días más con el
 * plan que venía pagando. La prueba Pro no cuenta (el plan guardado es
 * "gratis"). Sin la migración 0048 no se escribe nada (no existen las
 * columnas y el guardado fallaría).
 */
function downgradeGraceFields(current: SubscriptionRow | null, newPlan: Plan) {
  if (!current || !("grace_plan" in current)) return {};
  const now = new Date();
  const activeGrace =
    current.grace_plan && current.plan_grace_until && new Date(current.plan_grace_until) > now
      ? { plan: current.grace_plan as Plan, until: current.plan_grace_until }
      : null;
  const had: Plan = activeGrace?.plan ?? (lapsedToFree(current, now) ? "gratis" : current.plan);
  if (had !== "gratis" && planOrder.indexOf(newPlan) < planOrder.indexOf(had)) {
    return {
      grace_plan: had as "basico" | "pro" | "max",
      plan_grace_until:
        activeGrace?.until ?? new Date(now.getTime() + PLAN_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return { grace_plan: null, plan_grace_until: null };
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
  // Misma suscripción: el plan guardado manda (puede haber bajado en una renovación; la referencia es la del alta).
  const keepsPlan = current?.mp_preapproval_id === pre.id && current ? current.plan : null;

  if (pre.status === "authorized") {
    const previousId = current?.mp_preapproval_id && current.mp_preapproval_id !== pre.id ? current.mp_preapproval_id : null;
    const periodEnd =
      pre.next_payment_date ?? addMonths(new Date(), ref.cycle === "anual" ? 12 : 1).toISOString();
    const { error } = await admin.from("organization_subscriptions").upsert(
      {
        org_id: ref.orgId,
        plan: keepsPlan && keepsPlan !== "gratis" ? keepsPlan : ref.plan,
        billing_cycle: ref.cycle,
        mp_preapproval_id: pre.id,
        payment_status:
          current?.mp_preapproval_id === pre.id && current.payment_status === "past_due" ? "past_due" : "active",
        current_period_end: periodEnd,
        grace_until: current?.mp_preapproval_id === pre.id ? current.grace_until ?? null : null,
        payer_email: pre.payer_email ?? current?.payer_email ?? null,
        pro_trial_ends_at: null,
        // El paquete de la referencia es el de cuando se creó la suscripción: si después se cambió, no se pisa.
        ...(current?.mp_preapproval_id === pre.id ? {} : { invoice_pack: ref.pack, next_invoice_pack: null, next_plan: null }),
        ...downgradeGraceFields(current, keepsPlan && keepsPlan !== "gratis" ? keepsPlan : ref.plan),
      },
      { onConflict: "org_id" }
    );
    if (error) {
      // Sin la migración 0047 no existen las columnas del cobro.
      console.error("applyPreapproval", error.message);
      throw new Error(`No pudimos guardar el plan: ${error.message}`);
    }
    if (!keepsPlan && (current?.plan ?? "gratis") !== ref.plan) {
      await admin.from("plan_history").insert({
        org_id: ref.orgId,
        from_plan: current?.plan ?? "gratis",
        to_plan: ref.plan,
        changed_by: null,
      });
    }
    // Promo del primer mes: con el primer cobro aprobado, los siguientes
    // van al precio normal.
    await bumpPromoAmount(ref.orgId, pre, ref.plan, ref.cycle, ref.pack);
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
    if (ap.preapproval_id) {
      await bumpPromoAmount(ref.orgId, await getPreapproval(ap.preapproval_id), ref.plan, ref.cycle, ref.pack).catch((e) =>
        console.error("bumpPromoAmount", e)
      );
    }
    const base = ap.debit_date ? new Date(ap.debit_date) : new Date();
    // Es el cobro de la renovación (y no un aviso tardío de uno anterior) si cae cerca del fin del período que figura.
    const renewing = Boolean(
      ap.debit_date && current?.current_period_end && base.getTime() >= new Date(current.current_period_end).getTime() - 2 * 24 * 60 * 60 * 1000
    );
    await admin
      .from("organization_subscriptions")
      .update({
        payment_status: current?.payment_status === "cancelled" ? "cancelled" : "active",
        grace_until: null,
        current_period_end: addMonths(base, ref.cycle === "anual" ? 12 : 1).toISOString(),
        // Un plan o paquete que se bajó rige desde la renovación (no desde un aviso tardío de un cobro anterior).
        ...(renewing ? { ...(current?.next_invoice_pack != null ? { invoice_pack: current.next_invoice_pack, next_invoice_pack: null } : {}), ...(current?.next_plan ? { plan: current.next_plan, next_plan: null } : {}) } : {}),
      })
      .eq("org_id", ref.orgId);
    if (renewing && current?.next_plan && current.next_plan !== current.plan) {
      await admin.from("plan_history").insert({ org_id: ref.orgId, from_plan: current.plan, to_plan: current.next_plan, changed_by: null });
    }
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

/**
 * Si la suscripción salió de un checkout con la promo del primer mes, todavía
 * tiene el monto promocional y el primer cobro ya fue APROBADO, pasa los
 * próximos cobros al precio normal. Hasta que se aprueba no se toca: si el
 * primer cobro falla y Mercado Pago lo reintenta, se reintenta con la promo.
 * Sólo esas suscripciones: a nadie se le cambia el precio sin haber entrado
 * por la promo. Se llama al autorizarse la suscripción, al llegar cada cobro
 * y en cada sincronización (no depende de un solo aviso).
 */
async function bumpPromoAmount(orgId: string, pre: Preapproval, plan: Plan, cycle: BillingCycle, pack = 0) {
  const normal = chargeAmount(plan, cycle, pack);
  const current = Number(pre.auto_recurring?.transaction_amount ?? normal);
  if (!pre.preapproval_plan_id || current >= normal) return;
  // Si la promo ya terminó, un monto menor es un cambio a propósito (baja de plan o de paquete): no se toca.
  const { data: ended } = await createAdminClient().from("billing_events").select("id").eq("topic", "promo_ended").eq("mp_id", pre.id).limit(1);
  if (ended?.length) return;
  const charges = await searchAuthorizedPayments(pre.id).catch(() => []);
  if (!charges.some((c) => c.payment?.status === "approved")) return;
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_events")
    .select("detail")
    .eq("org_id", orgId)
    .eq("topic", "checkout")
    .eq("mp_id", pre.preapproval_plan_id)
    .limit(1);
  const detail = (data?.[0]?.detail ?? null) as { promo?: boolean } | null;
  if (!detail?.promo) return;
  try {
    await updatePreapprovalAmount(pre.id, normal);
    await logEvent(orgId, "promo_ended", pre.id, "updated", normal, { from: current, to: normal });
  } catch (e) {
    console.error("No pudimos pasar la suscripción al precio normal", pre.id, e);
  }
}

/**
 * Pago único (Checkout Pro): el plan queda pago por un mes o un año, sin
 * renovación automática. Se guarda como payment_status "cancelled" sin
 * suscripción (mp_preapproval_id null): org_effective_plan lo pasa a Gratis
 * al terminar el período. Si todavía le quedaba tiempo del mismo plan, se
 * suma a continuación. Cada pago se aplica una sola vez.
 */
export async function applyOneTimePayment(pay: Payment): Promise<string | null> {
  const ref = parseExternalReference(pay.external_reference);
  if (!ref || (!ref.oneTime && ref.addonAmount === null)) return null;
  if (pay.status !== "approved") return ref.orgId;
  const admin = createAdminClient();
  if (ref.addonAmount !== null) return applyPackAddon(pay, { ...ref, addonAmount: ref.addonAmount });

  const { data: already } = await admin
    .from("billing_events")
    .select("id")
    .eq("topic", "payment_applied")
    .eq("mp_id", String(pay.id))
    .limit(1);
  if (already?.length) return ref.orgId;
  if (Number(pay.transaction_amount) + 0.01 < firstChargeAmount(ref.plan, ref.cycle, true, ref.pack)) {
    console.error("Pago único con monto menor al del plan", pay.id, pay.transaction_amount);
    await logEvent(ref.orgId, "payment", String(pay.id), "monto_invalido", pay.transaction_amount, pay);
    return ref.orgId;
  }

  const { data: current } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("org_id", ref.orgId)
    .maybeSingle();

  const now = new Date();
  const currentEnd = current?.current_period_end ? new Date(current.current_period_end) : null;
  const base =
    current?.plan === ref.plan && currentEnd && currentEnd > now && current.payment_status !== "past_due"
      ? currentEnd
      : now;
  const previousId =
    current?.mp_preapproval_id && current.payment_status !== "cancelled" ? current.mp_preapproval_id : null;

  const { error } = await admin.from("organization_subscriptions").upsert(
    {
      org_id: ref.orgId,
      plan: ref.plan,
      billing_cycle: ref.cycle,
      mp_preapproval_id: null,
      payment_status: "cancelled",
      current_period_end: addMonths(base, ref.cycle === "anual" ? 12 : 1).toISOString(),
      grace_until: null,
      pro_trial_ends_at: null,
      invoice_pack: ref.pack,
      ...downgradeGraceFields(current, ref.plan),
    },
    { onConflict: "org_id" }
  );
  if (error) {
    console.error("applyOneTimePayment", error.message);
    throw new Error(`No pudimos guardar el plan: ${error.message}`);
  }
  await logEvent(ref.orgId, "payment_applied", String(pay.id), pay.status, pay.transaction_amount, pay);
  if ((current?.plan ?? "gratis") !== ref.plan) {
    await admin.from("plan_history").insert({
      org_id: ref.orgId,
      from_plan: current?.plan ?? "gratis",
      to_plan: ref.plan,
      changed_by: null,
    });
  }
  // Pasó de débito automático a pago único: el débito deja de cobrarse.
  if (previousId) {
    await cancelPreapproval(previousId).catch((e) => console.error("No pudimos cancelar el débito anterior", e));
  }
  return ref.orgId;
}

/** Plan que rige desde la próxima renovación: el que se programó al bajar, o el actual. */
async function renewalPlan(orgId: string, fallback: Plan): Promise<Plan> {
  const { data } = await createAdminClient().from("organization_subscriptions").select("next_plan").eq("org_id", orgId).maybeSingle();
  return (data?.next_plan as Plan | null | undefined) ?? fallback;
}

export interface PlanChange {
  /** downgrade: baja a un plan más barato desde la renovación; restore: se cancela una baja programada. */
  kind: "downgrade" | "restore";
  /** Monto de los próximos cobros (plan + paquete). */
  next: number;
  nextDate: string;
}

/**
 * Bajar de plan con un débito automático activo (mismo ciclo): no se crea otra suscripción ni se cobra nada hoy. Sigue
 * valiendo el plan actual, que ya está pago, y desde la renovación se cobra el plan nuevo con el mismo paquete de
 * facturas. null = no corresponde (sin débito activo, otro ciclo, o no es una baja): se contrata como siempre.
 */
export function planChange(sub: SubscriptionInfo, plan: Plan, cycle: BillingCycle, now = new Date()): PlanChange | null {
  const b = sub.billing;
  if (sub.plan === "gratis" || !b || b.status !== "active" || !b.mpPreapprovalId || b.cycle !== cycle || !b.currentPeriodEnd) return null;
  if (new Date(b.currentPeriodEnd) <= now) return null;
  const pack = sub.nextInvoicePack ?? sub.invoicePack;
  const nextDate = new Date(b.currentPeriodEnd).toISOString();
  if (plan === sub.plan) return sub.nextPlan ? { kind: "restore", next: chargeAmount(sub.plan, cycle, pack), nextDate } : null;
  if (plan === "gratis" || planOrder.indexOf(plan) > planOrder.indexOf(sub.plan)) return null;
  return { kind: "downgrade", next: chargeAmount(plan, cycle, pack), nextDate };
}

/** Programa la baja de plan (o la cancela con `plan` = el actual): el débito cobra el monto nuevo desde la renovación. */
export async function scheduleDowngrade(orgId: string, preapprovalId: string, current: Plan, target: Plan, cycle: BillingCycle, pack: number) {
  const restore = target === current;
  await updatePreapprovalAmount(preapprovalId, chargeAmount(target, cycle, pack));
  const { error } = await createAdminClient().from("organization_subscriptions").update({ next_plan: restore ? null : (target as "basico" | "pro" | "max") }).eq("org_id", orgId);
  if (error) throw new Error(`No pudimos guardar el cambio: ${error.message}`);
  await logEvent(orgId, restore ? "plan_downgrade_cancelled" : "plan_downgrade_scheduled", preapprovalId, "scheduled", chargeAmount(target, cycle, pack), { plan: target });
}

export interface PackChange {
  /** restore: había un cambio a la baja programado y se vuelve a elegir el paquete actual (no se cobra nada). */
  kind: "upgrade" | "downgrade" | "same" | "restore";
  /** Lo que se paga hoy: el paquete completo (0 si se baja o se quita). Sólo en pago anual se cobran los meses que quedan. */
  today: number;
  /** Monto de los próximos cobros del débito (plan + paquete). */
  next: number;
  /** Próximo cobro. */
  nextDate: string;
}

/**
 * Cambiar el paquete de facturas con un débito automático activo del mismo plan y ciclo: no se crea otra suscripción
 * (eso cobraría el plan dos veces). Si se sube, se cobra aparte hoy el paquete completo (no proporcional: las facturas
 * se pueden usar todas en un día) y el débito pasa a
 * cobrar plan + paquete desde la renovación; si se baja o se quita, no se cobra nada y rige desde la renovación.
 * null = no corresponde (otro plan, otro ciclo, sin débito activo): se contrata como siempre.
 */
export function packChange(sub: SubscriptionInfo, plan: Plan, cycle: BillingCycle, pack: number, now = new Date()): PackChange | null {
  const b = sub.billing;
  if (sub.plan !== plan || !b || b.status !== "active" || !b.mpPreapprovalId || b.cycle !== cycle || !b.currentPeriodEnd) return null;
  const end = new Date(b.currentPeriodEnd);
  if (end <= now) return null;
  const current = sub.invoicePack;
  const next = chargeAmount(plan, cycle, pack);
  const nextDate = end.toISOString();
  if (pack === current && sub.nextInvoicePack === null) return { kind: "same", today: 0, next, nextDate };
  if (pack === current) return { kind: "restore", today: 0, next, nextDate };
  if (pack < current) return { kind: "downgrade", today: 0, next, nextDate };
  const start = addMonths(end, cycle === "anual" ? -12 : -1);
  const periodMs = Math.max(1, end.getTime() - start.getTime());
  const diff = chargeAmount(plan, cycle, pack) - chargeAmount(plan, cycle, current);
  if (cycle === "mensual") return { kind: "upgrade", today: Math.max(1, diff), next, nextDate };
  // Anual: el cupo es mensual, así que se cobran los meses que quedan del año.
  const leftMs = Math.min(periodMs, Math.max(0, end.getTime() - now.getTime()));
  const monthsLeft = Math.max(1, Math.min(12, Math.ceil((leftMs / periodMs) * 12)));
  return { kind: "upgrade", today: Math.max(1, Math.round((diff / 12) * monthsLeft)), next, nextDate };
}

/** Vuelve a dejar el paquete actual (se cancela una baja programada): el débito vuelve a cobrar plan + paquete. */
export async function cancelScheduledPack(orgId: string, preapprovalId: string, plan: Plan, cycle: BillingCycle, pack: number) {
  await updatePreapprovalAmount(preapprovalId, chargeAmount(await renewalPlan(orgId, plan), cycle, pack));
  const { error } = await createAdminClient().from("organization_subscriptions").update({ next_invoice_pack: null }).eq("org_id", orgId);
  if (error) throw new Error(`No pudimos guardar el cambio: ${error.message}`);
}

/** Baja o quita el paquete: el débito cobra menos desde la renovación y el paquete actual rige hasta entonces. */
export async function scheduleLowerPack(orgId: string, preapprovalId: string, plan: Plan, cycle: BillingCycle, pack: number) {
  await updatePreapprovalAmount(preapprovalId, chargeAmount(await renewalPlan(orgId, plan), cycle, pack));
  const { error } = await createAdminClient().from("organization_subscriptions").update({ next_invoice_pack: pack }).eq("org_id", orgId);
  if (error) throw new Error(`No pudimos guardar el cambio: ${error.message}`);
  await logEvent(orgId, "pack_scheduled", preapprovalId, "scheduled", chargeAmount(plan, cycle, pack), { pack });
}

/**
 * Pago aparte de un paquete sobre un débito activo: el paquete rige desde ya y el débito pasa a cobrar plan + paquete
 * desde la renovación. Se aplica una sola vez por pago.
 */
async function applyPackAddon(pay: Payment, ref: { orgId: string; plan: Plan; cycle: BillingCycle; pack: number; addonAmount: number }): Promise<string | null> {
  const admin = createAdminClient();
  const { data: already } = await admin.from("billing_events").select("id").eq("topic", "payment_applied").eq("mp_id", String(pay.id)).limit(1);
  if (already?.length) return ref.orgId;
  if (Number(pay.transaction_amount) + 0.01 < ref.addonAmount) {
    console.error("Pago de paquete con monto menor al esperado", pay.id, pay.transaction_amount);
    await logEvent(ref.orgId, "payment", String(pay.id), "monto_invalido", pay.transaction_amount, pay);
    return ref.orgId;
  }
  const { data: current } = await admin.from("organization_subscriptions").select("*").eq("org_id", ref.orgId).maybeSingle();
  if (!current?.mp_preapproval_id || current.plan !== ref.plan) {
    // Ya no tiene ese débito: se anota para revisarlo a mano (el pago existe).
    await logEvent(ref.orgId, "payment", String(pay.id), "sin_debito", pay.transaction_amount, pay);
    return ref.orgId;
  }
  await updatePreapprovalAmount(current.mp_preapproval_id, chargeAmount(current.next_plan ?? ref.plan, ref.cycle, ref.pack));
  const { error } = await admin.from("organization_subscriptions").update({ invoice_pack: ref.pack, next_invoice_pack: null }).eq("org_id", ref.orgId);
  if (error) throw new Error(`No pudimos guardar el paquete: ${error.message}`);
  await logEvent(ref.orgId, "payment_applied", String(pay.id), pay.status, pay.transaction_amount, pay);
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
  if (topic === "payment") {
    return applyOneTimePayment(await getPayment(id));
  }
  return null;
}

const CHECKOUT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export type PaymentMethod = "debito" | "unico";
export type CheckoutState = "paid" | "pending" | "none";

interface CheckoutDetail {
  plan: Plan;
  cycle: BillingCycle;
  method: PaymentMethod;
  /** Primer cobro con la promo del primer mes. */
  promo?: boolean;
  /** Paquete de facturas por mes (0 o ausente: sin paquete). */
  pack?: number;
  /** external_reference del pago único. */
  ref?: string;
  /** Pago aparte de un paquete sobre un débito activo, y su monto. */
  addon?: boolean;
  addonAmount?: number;
}

/** Anota un checkout abierto para buscar después su pago. */
export async function recordCheckout(orgId: string, checkoutId: string, detail: CheckoutDetail) {
  await logEvent(orgId, "checkout", checkoutId, "pending", detail.addon ? detail.addonAmount ?? null : firstChargeAmount(detail.plan, detail.cycle, Boolean(detail.promo), detail.pack ?? 0), detail);
}

/** ¿Se pagó el checkout? Si se pagó, lo aplica. */
async function applyCheckoutIfPaid(orgId: string, checkoutId: string, detail: CheckoutDetail): Promise<CheckoutState> {
  if (detail.method === "unico") {
    if (!detail.ref) return "none";
    const payments = await searchPaymentsByReference(detail.ref);
    const approved = payments.find((p) => p.status === "approved");
    if (approved) {
      if ((await applyOneTimePayment(approved)) !== orgId) return "none";
      await logEvent(orgId, "checkout_done", checkoutId, "approved", null, { payment_id: approved.id });
      return "paid";
    }
    return payments.some((p) => p.status === "pending" || p.status === "in_process") ? "pending" : "none";
  }
  const found = await searchPreapprovalsByPlan(checkoutId);
  const paid = found.find((p) => p.status === "authorized");
  if (!paid || (await referenceOf(paid))?.orgId !== orgId) return "none";
  await applyPreapproval(paid);
  await logEvent(orgId, "checkout_done", checkoutId, "authorized", null, { preapproval_id: paid.id });
  return "paid";
}

async function checkoutEvents(orgId: string) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - CHECKOUT_WINDOW_MS).toISOString();
  const { data } = await admin
    .from("billing_events")
    .select("topic, mp_id, detail")
    .eq("org_id", orgId)
    .in("topic", ["checkout", "checkout_done"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  const events = data ?? [];
  const done = new Set(events.filter((e) => e.topic === "checkout_done").map((e) => e.mp_id));
  const opened = new Map(
    events
      .filter((e) => e.topic === "checkout")
      .map((e) => {
        const d = (e.detail ?? {}) as Partial<CheckoutDetail>;
        return [e.mp_id, { ...d, method: d.method ?? "debito" } as CheckoutDetail] as const;
      })
  );
  return { done, opened };
}

/**
 * Busca en Mercado Pago si se pagó alguno de los checkouts abiertos en los
 * últimos días y lo aplica. Así el plan se activa aunque Mercado Pago no
 * vuelva a Pesito con el id ni llegue el aviso (webhook).
 */
export async function syncPendingCheckouts(orgId: string): Promise<void> {
  const { done, opened } = await checkoutEvents(orgId);
  const pending = [...opened].filter(([id]) => !done.has(id)).slice(0, 3);
  for (const [checkoutId, detail] of pending) await applyCheckoutIfPaid(orgId, checkoutId, detail);
}

/**
 * ¿Se pagó este checkout puntual (el que se abrió desde la pantalla)? Sólo
 * mira checkouts de este negocio. Un plan que ya se tenía no cuenta.
 */
export async function checkoutState(orgId: string, checkoutId: string): Promise<CheckoutState> {
  const { done, opened } = await checkoutEvents(orgId);
  if (done.has(checkoutId)) return "paid";
  const detail = opened.get(checkoutId);
  if (!detail) return "none";
  return applyCheckoutIfPaid(orgId, checkoutId, detail);
}

/**
 * Respaldo de la promo: si la suscripción actual salió de un checkout con
 * promo y todavía no pasó al precio normal, se revisa si el primer cobro ya
 * se aprobó (por si el aviso de ese cobro no llegó).
 */
async function ensurePromoEnded(orgId: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: events }, { data: sub }] = await Promise.all([
    admin
      .from("billing_events")
      .select("topic, detail")
      .eq("org_id", orgId)
      .in("topic", ["checkout", "promo_ended"])
      .limit(50),
    admin.from("organization_subscriptions").select("*").eq("org_id", orgId).maybeSingle(),
  ]);
  const hadPromo = (events ?? []).some(
    (e) => e.topic === "checkout" && (e.detail as { promo?: boolean; method?: string } | null)?.promo &&
      (e.detail as { method?: string }).method !== "unico"
  );
  const ended = (events ?? []).some((e) => e.topic === "promo_ended");
  if (!hadPromo || ended || !sub?.mp_preapproval_id || sub.payment_status === "cancelled") return;
  const pre = await getPreapproval(sub.mp_preapproval_id);
  const ref = await referenceOf(pre);
  if (ref?.orgId === orgId) await bumpPromoAmount(orgId, pre, ref.plan, ref.cycle, ref.pack);
}

/**
 * Al volver de Mercado Pago: se aplica lo que venga en la URL (suscripción o
 * pago, sólo si es de este negocio) y además se buscan los checkouts pagados,
 * porque Mercado Pago no siempre vuelve con el id. Sólo servidor.
 */
export async function syncReturnedPayment(
  orgId: string,
  ids: { preapprovalId?: string; paymentId?: string } = {}
): Promise<void> {
  if (!mercadoPagoConfigured()) return;
  const valid = (v?: string) => Boolean(v && /^[0-9a-zA-Z_-]{4,64}$/.test(v));
  try {
    if (valid(ids.preapprovalId)) {
      const pre = await getPreapproval(ids.preapprovalId!);
      if ((await referenceOf(pre))?.orgId === orgId) await applyPreapproval(pre);
    }
    if (valid(ids.paymentId)) {
      const pay = await getPayment(ids.paymentId!);
      if (parseExternalReference(pay.external_reference)?.orgId === orgId) await applyOneTimePayment(pay);
    }
    await syncPendingCheckouts(orgId);
    await ensurePromoEnded(orgId);
  } catch (e) {
    console.error("syncReturnedPayment", e instanceof MercadoPagoError ? e.body : e);
  }
}
