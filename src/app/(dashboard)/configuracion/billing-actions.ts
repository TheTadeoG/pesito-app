"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels, type BillingCycle, type Plan } from "@/lib/subscription";
import crypto from "crypto";
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
  chargeAmount,
  checkoutState,
  recordCheckout,
  type CheckoutState,
  type PaymentMethod,
} from "@/lib/billing";

export interface BillingActionResult {
  error?: string;
  url?: string;
  /** Id del checkout abierto, para preguntar después si se pagó. */
  checkoutId?: string;
}

const PAID: Plan[] = ["esencial", "pro", "ia"];

/**
 * Arma el pago en Mercado Pago y devuelve el link (se abre en otra pestaña):
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
  method: PaymentMethod = "debito"
): Promise<BillingActionResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede contratar un plan." };
  if (!PAID.includes(plan) || (cycle !== "mensual" && cycle !== "anual")) return { error: "Elegí un plan válido." };
  if (method !== "debito" && method !== "unico") return { error: "Elegí cómo querés pagar." };
  if (!mercadoPagoConfigured()) return { error: "El cobro con Mercado Pago todavía no está configurado." };

  const backUrl = `${siteUrl}/suscribirse/listo`;
  const amount = chargeAmount(plan, cycle);
  try {
    if (method === "unico") {
      const ref = `${buildExternalReference(organization.id, plan, cycle)}|u${crypto.randomBytes(6).toString("hex")}`;
      const pref = await createPreference({
        title: `Pesito — Plan ${planLabels[plan]} (${cycle === "anual" ? "1 año" : "1 mes"})`,
        externalReference: ref,
        amount,
        backUrl,
      });
      const url = usingTestCredentials() ? pref.sandbox_init_point ?? pref.init_point : pref.init_point;
      if (!url) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
      await recordCheckout(organization.id, pref.id, { plan, cycle, method, ref });
      return { url, checkoutId: pref.id };
    }

    const checkout = await createPreapprovalPlan({
      reason: `Pesito — Plan ${planLabels[plan]} (${cycle})`,
      externalReference: buildExternalReference(organization.id, plan, cycle),
      frequencyMonths: cycle === "anual" ? 12 : 1,
      amount,
      backUrl,
    });
    if (!checkout.init_point) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
    await recordCheckout(organization.id, checkout.id, { plan, cycle, method });
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
  revalidatePath("/configuracion");
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
 * Mientras la persona paga en Mercado Pago (en otra pestaña), la pantalla
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
