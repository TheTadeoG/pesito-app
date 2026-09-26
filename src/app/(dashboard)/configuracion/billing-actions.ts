"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels, type BillingCycle, type Plan } from "@/lib/subscription";
import { siteUrl } from "@/lib/utils";
import {
  cancelPreapproval,
  createPreapproval,
  getPreapproval,
  mercadoPagoConfigured,
  MercadoPagoError,
} from "@/lib/mercadopago";
import {
  applyPreapproval,
  buildExternalReference,
  chargeAmount,
  parseExternalReference,
} from "@/lib/billing";

export interface BillingActionResult {
  error?: string;
  url?: string;
}

const PAID: Plan[] = ["esencial", "pro", "ia"];

/**
 * Crea la suscripción en Mercado Pago y devuelve el link para que la persona
 * cargue su tarjeta o dinero en cuenta. El plan se activa cuando Mercado
 * Pago avisa que quedó autorizada (webhook o al volver a Pesito).
 */
export async function startSubscription(
  plan: Plan,
  cycle: BillingCycle,
  payerEmail: string
): Promise<BillingActionResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede contratar un plan." };
  if (!PAID.includes(plan) || (cycle !== "mensual" && cycle !== "anual")) return { error: "Elegí un plan válido." };
  if (!mercadoPagoConfigured()) return { error: "El cobro con Mercado Pago todavía no está configurado." };
  const email = payerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Ingresá el email de tu cuenta de Mercado Pago." };
  }

  try {
    const pre = await createPreapproval({
      reason: `Pesito — Plan ${planLabels[plan]} (${cycle})`,
      externalReference: buildExternalReference(organization.id, plan, cycle),
      payerEmail: email,
      frequencyMonths: cycle === "anual" ? 12 : 1,
      amount: chargeAmount(plan, cycle),
      backUrl: `${siteUrl}/configuracion?tab=plan`,
    });
    if (!pre.init_point) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
    return { url: pre.init_point };
  } catch (e) {
    console.error("startSubscription", e instanceof MercadoPagoError ? e.body : e);
    return { error: "No pudimos conectar con Mercado Pago. Probá de nuevo en un rato." };
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

/**
 * Al volver de Mercado Pago (?preapproval_id=…): se consulta y se aplica al
 * toque, sin esperar el aviso. Sólo si la suscripción es de este negocio.
 */
export async function syncReturnedPreapproval(orgId: string, preapprovalId: string): Promise<void> {
  if (!mercadoPagoConfigured() || !/^[0-9a-zA-Z_-]{8,64}$/.test(preapprovalId)) return;
  try {
    const pre = await getPreapproval(preapprovalId);
    if (parseExternalReference(pre.external_reference)?.orgId !== orgId) return;
    await applyPreapproval(pre);
  } catch (e) {
    console.error("syncReturnedPreapproval", e instanceof MercadoPagoError ? e.body : e);
  }
}
