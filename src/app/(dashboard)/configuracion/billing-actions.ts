"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels, type BillingCycle, type Plan } from "@/lib/subscription";
import crypto from "crypto";
import { formatCount, isValidPack } from "@/lib/invoice-packs";
import { siteUrl } from "@/lib/utils";
import {
  cancelPreapproval,
  createPreapprovalPlan,
  createPreference,
  getPreapproval,
  mercadoPagoConfigured,
  mercadoPagoErrorMessage,
  MercadoPagoError,
  usingTestCredentials,
} from "@/lib/mercadopago";
import {
  applyPreapproval,
  buildExternalReference,
  cancelScheduledPack,
  checkoutState,
  firstChargeAmount,
  isPromoEligible,
  packChange,
  planChange,
  recordCheckout,
  scheduleDowngrade,
  upgradeChange,
  scheduleLowerPack,
  type CheckoutState,
  type PaymentMethod,
} from "@/lib/billing";

export interface BillingActionResult {
  error?: string;
  url?: string;
  /** Id del checkout abierto, para preguntar después si se pagó. */
  checkoutId?: string;
}

const PAID: Plan[] = ["basico", "pro", "max"];

/**
 * Arma el pago en Mercado Pago y devuelve el link (se abre en la misma pestaña):
 * - débito automático: checkout de un plan de suscripción (tarjeta o cuenta
 *   de Mercado Pago, sin pedir antes el email);
 * - pago único: Checkout Pro por un mes o un año (tarjeta, dinero en cuenta
 *   o efectivo), sin renovación automática.
 * El plan se activa cuando se confirma el pago (la pantalla pregunta, llega
 * el aviso o se vuelve a Pesito).
 */
export async function startSubscription(
  plan: Plan,
  cycle: BillingCycle,
  method: PaymentMethod = "debito",
  pack = 0
): Promise<BillingActionResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede contratar un plan." };
  if (!PAID.includes(plan) || (cycle !== "mensual" && cycle !== "anual")) return { error: "Elegí un plan válido." };
  if (method !== "debito" && method !== "unico") return { error: "Elegí cómo querés pagar." };
  if (!Number.isInteger(pack) || !isValidPack(pack)) return { error: "Elegí un paquete de facturas válido." };
  if (!mercadoPagoConfigured()) return { error: "El cobro con Mercado Pago todavía no está configurado." };

  const backUrl = `${siteUrl}/suscribirse/listo`;

  // Baja de plan (o se cancela una baja programada) con débito activo: sin cobro hoy, rige desde la renovación y se
  // mantiene el paquete de facturas.
  if (method === "debito") {
    const sub = await getSubscription(await createClient(), organization.id);
    const up = upgradeChange(sub, plan, cycle, pack);
    if (up) {
      // Mejora de plan: se cobra aparte sólo la diferencia con lo ya pago y el débito sube desde la renovación.
      try {
        const ref = `${buildExternalReference(organization.id, plan, cycle, pack)}|a${up.today}_${crypto.randomBytes(6).toString("hex")}`;
        const pref = await createPreference({
          title: `Pesito mejora al Plan ${planLabels[plan]} (diferencia con lo que ya pagaste)`.slice(0, 120),
          externalReference: ref,
          amount: up.today,
          backUrl,
        });
        const url = usingTestCredentials() ? pref.sandbox_init_point ?? pref.init_point : pref.init_point;
        if (!url) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
        await recordCheckout(organization.id, pref.id, { plan, cycle, method: "unico", ref, pack, addon: true, addonAmount: up.today });
        return { url, checkoutId: pref.id };
      } catch (e) {
        console.error("startSubscription (mejora de plan)", e instanceof MercadoPagoError ? e.body : e);
        return { error: mercadoPagoErrorMessage(e) ? `Mercado Pago rechazó el pedido: ${mercadoPagoErrorMessage(e)}` : "No pudimos conectar con Mercado Pago. Probá de nuevo en un rato." };
      }
    }
    const down = planChange(sub, plan, cycle);
    if (down && (down.kind === "downgrade" || pack === (sub.nextInvoicePack ?? sub.invoicePack))) {
      try {
        await scheduleDowngrade(organization.id, sub.billing!.mpPreapprovalId!, sub.plan, plan, cycle, sub.nextInvoicePack ?? sub.invoicePack);
        revalidatePath("/planes");
        return { url: "/planes", checkoutId: "sin-cobro" };
      } catch (e) {
        console.error("startSubscription (baja de plan)", e instanceof MercadoPagoError ? e.body : e);
        return { error: "No pudimos programar el cambio de plan. Probá de nuevo en un rato." };
      }
    }
  }

  // Ya tiene este plan con débito automático y sólo cambia el paquete de facturas: no se crea otra suscripción (cobraría
  // el plan dos veces). Si lo sube, se cobra aparte sólo lo que falta del período; el débito suma el paquete desde la renovación.
  if (method === "debito") {
    const current = await getSubscription(await createClient(), organization.id);
    const change = packChange(current, plan, cycle, pack);
    if (change) {
      const preapprovalId = current.billing!.mpPreapprovalId!;
      try {
        if (change.kind === "same") return { error: "Ya tenés ese paquete." };
        if (change.kind === "downgrade") {
          await scheduleLowerPack(organization.id, preapprovalId, plan, cycle, pack);
          revalidatePath("/planes");
          return { url: "/planes", checkoutId: "sin-cobro" };
        }
        if (change.kind === "restore") {
          await cancelScheduledPack(organization.id, preapprovalId, plan, cycle, pack);
          revalidatePath("/planes");
          return { url: "/planes", checkoutId: "sin-cobro" };
        }
        const ref = `${buildExternalReference(organization.id, plan, cycle, pack)}|a${change.today}_${crypto.randomBytes(6).toString("hex")}`;
        const pref = await createPreference({
          title: `Pesito paquete de ${formatCount(pack)} facturas por mes (lo que resta del período)`.slice(0, 120),
          externalReference: ref,
          amount: change.today,
          backUrl,
        });
        const url = usingTestCredentials() ? pref.sandbox_init_point ?? pref.init_point : pref.init_point;
        if (!url) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
        await recordCheckout(organization.id, pref.id, { plan, cycle, method: "unico", ref, pack, addon: true, addonAmount: change.today });
        return { url, checkoutId: pref.id };
      } catch (e) {
        console.error("startSubscription (paquete)", e instanceof MercadoPagoError ? e.body : e);
        return { error: mercadoPagoErrorMessage(e) ? `Mercado Pago rechazó el pedido: ${mercadoPagoErrorMessage(e)}` : "No pudimos conectar con Mercado Pago. Probá de nuevo en un rato." };
      }
    }
  }
  // Promo del primer mes (mensual, para quien nunca pagó un plan).
  const promo = cycle === "mensual" && (await isPromoEligible(organization.id));
  // Prueba de cobro real: sólo el negocio de MP_TEST_ORG_ID paga $1 (débito
  // automático mensual). Sin la variable no hace nada. Sin promo, así el
  // monto no se sube solo después del primer cobro.
  const testPrice = method === "debito" && cycle === "mensual" && process.env.MP_TEST_ORG_ID === organization.id;
  const amount = testPrice ? 15 : firstChargeAmount(plan, cycle, promo, pack);
  const packLabel = pack > 0 ? ` + paquete de ${formatCount(pack)} facturas por mes` : "";
  try {
    if (method === "unico") {
      const ref = `${buildExternalReference(organization.id, plan, cycle, pack)}|u${crypto.randomBytes(6).toString("hex")}`;
      const pref = await createPreference({
        title: `Pesito — Plan ${planLabels[plan]}${packLabel} (${cycle === "anual" ? "1 año" : promo ? "primer mes, promo" : "1 mes"})`,
        externalReference: ref,
        amount,
        backUrl,
      });
      const url = usingTestCredentials() ? pref.sandbox_init_point ?? pref.init_point : pref.init_point;
      if (!url) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
      await recordCheckout(organization.id, pref.id, { plan, cycle, method, ref, promo, pack });
      return { url, checkoutId: pref.id };
    }

    const checkout = await createPreapprovalPlan({
      // Mercado Pago acepta hasta 60 caracteres en el motivo.
      reason: (testPrice
        ? `Pesito Plan ${planLabels[plan]} (prueba de cobro)`
        : `Pesito Plan ${planLabels[plan]}${pack > 0 ? ` + ${formatCount(pack)} facturas` : ""} (${promo ? "promo 1.er mes" : cycle})`
      ).slice(0, 60),
      externalReference: buildExternalReference(organization.id, plan, cycle, pack),
      frequencyMonths: cycle === "anual" ? 12 : 1,
      amount,
      backUrl,
    });
    if (!checkout.init_point) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
    await recordCheckout(organization.id, checkout.id, { plan, cycle, method, promo: promo && !testPrice, pack });
    return { url: checkout.init_point, checkoutId: checkout.id };
  } catch (e) {
    const detail = mercadoPagoErrorMessage(e);
    console.error("startSubscription", e instanceof MercadoPagoError ? e.body : e);
    return {
      error: detail
        ? `Mercado Pago rechazó el pedido: ${detail}`
        : "No pudimos conectar con Mercado Pago. Probá de nuevo en un rato.",
    };
  }
}

/** Cancela el débito automático: el plan sigue hasta el fin del período pago. */
export async function cancelSubscription(): Promise<BillingActionResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede cancelar el plan." };
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  const id = subscription.billing?.mpPreapprovalId;
  if (!id) return { error: "No encontramos una suscripción activa." };
  try {
    await cancelPreapproval(id);
    await applyPreapproval(await getPreapproval(id));
  } catch (e) {
    console.error("cancelSubscription", e instanceof MercadoPagoError ? e.body : e);
    return { error: "No pudimos cancelar en Mercado Pago. Probá de nuevo en un rato." };
  }
  revalidatePath("/planes");
  return {};
}

/** Link de Mercado Pago para cambiar la tarjeta (con un cobro fallido). */
export async function getUpdatePaymentUrl(): Promise<BillingActionResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede hacer esto." };
  const supabase = await createClient();
  const id = (await getSubscription(supabase, organization.id)).billing?.mpPreapprovalId;
  if (!id) return { error: "No encontramos una suscripción activa." };
  try {
    const pre = await getPreapproval(id);
    return pre.init_point ? { url: pre.init_point } : { error: "Mercado Pago no devolvió el link." };
  } catch {
    return { error: "No pudimos conectar con Mercado Pago. Probá de nuevo en un rato." };
  }
}

export interface CheckoutStatus {
  /** paid: se pagó y el plan quedó activo; pending: pago en efectivo sin acreditar. */
  state: CheckoutState;
  plan: Plan;
  periodEnd: string | null;
}

/**
 * Mientras la persona paga en Mercado Pago , la pantalla
 * pregunta cada tanto si ya se pagó ese checkout, para avisarle y seguir sola.
 */
export async function checkPendingCheckout(checkoutId: string): Promise<CheckoutStatus> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  let state: CheckoutState = "none";
  if (mercadoPagoConfigured() && typeof checkoutId === "string" && checkoutId.length <= 80) {
    state = await checkoutState(organization.id, checkoutId).catch((e: unknown) => {
      console.error("checkPendingCheckout", e instanceof MercadoPagoError ? e.body : e);
      return "none" as const;
    });
  }
  const subscription = await getSubscription(supabase, organization.id);
  return { state, plan: subscription.plan, periodEnd: subscription.billing?.currentPeriodEnd ?? null };
}
