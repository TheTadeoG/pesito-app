"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels, type BillingCycle, type Plan } from "@/lib/subscription";
import { siteUrl } from "@/lib/utils";
import {
  cancelPreapproval,
  createPreapprovalPlan,
  getPreapproval,
  mercadoPagoConfigured,
  mercadoPagoErrorMessage,
  MercadoPagoError,
} from "@/lib/mercadopago";
import {
  applyPreapproval,
  buildExternalReference,
  chargeAmount,
  recordCheckout,
  isCheckoutPaid,
} from "@/lib/billing";

export interface BillingActionResult {
  error?: string;
  url?: string;
  /** Id del checkout abierto, para preguntar después si se pagó. */
  checkoutId?: string;
}

const PAID: Plan[] = ["esencial", "pro", "ia"];

/**
 * Arma el checkout de Mercado Pago para el plan y devuelve el link: ahí la
 * persona paga con tarjeta o iniciando sesión en Mercado Pago (no hace falta
 * pedirle antes el email). El plan se activa cuando Mercado Pago avisa que
 * la suscripción quedó autorizada (webhook o al volver a Pesito).
 * `from`: a dónde vuelve después de pagar (Configuración o el alta nueva).
 */
export async function startSubscription(
  plan: Plan,
  cycle: BillingCycle,
  from: "configuracion" | "alta" = "configuracion"
): Promise<BillingActionResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede contratar un plan." };
  if (!PAID.includes(plan) || (cycle !== "mensual" && cycle !== "anual")) return { error: "Elegí un plan válido." };
  if (!mercadoPagoConfigured()) return { error: "El cobro con Mercado Pago todavía no está configurado." };

  try {
    const checkout = await createPreapprovalPlan({
      reason: `Pesito — Plan ${planLabels[plan]} (${cycle})`,
      externalReference: buildExternalReference(organization.id, plan, cycle),
      frequencyMonths: cycle === "anual" ? 12 : 1,
      amount: chargeAmount(plan, cycle),
      backUrl: from === "alta" ? `${siteUrl}/suscribirse` : `${siteUrl}/configuracion?tab=plan`,
    });
    if (!checkout.init_point) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
    await recordCheckout(organization.id, checkout.id, plan, cycle);
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
  /** Se pagó este checkout y el plan quedó activo. */
  paid: boolean;
  plan: Plan;
}

/**
 * Mientras la persona paga en Mercado Pago (en otra pestaña), la pantalla
 * pregunta cada tanto si ya se pagó ese checkout, para avisarle y seguir sola.
 */
export async function checkPendingCheckout(checkoutId: string): Promise<CheckoutStatus> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  let paid = false;
  if (mercadoPagoConfigured() && typeof checkoutId === "string" && checkoutId.length <= 64) {
    paid = await isCheckoutPaid(organization.id, checkoutId).catch((e) => {
      console.error("checkPendingCheckout", e instanceof MercadoPagoError ? e.body : e);
      return false;
    });
  }
  const subscription = await getSubscription(supabase, organization.id);
  return { paid, plan: subscription.plan };
}
