import crypto from "crypto";

// Cliente mínimo de la API de Mercado Pago para las suscripciones de los
// planes (sin SDK: son 4 llamadas). Sólo servidor: usa MP_ACCESS_TOKEN.
// Docs: /preapproval (suscripciones sin plan asociado, pago pendiente),
// /authorized_payments/{id} (cada cobro) y firma de webhooks (x-signature).

// MP_API_BASE sólo para pruebas locales (un servidor que imita la API).
const API = process.env.MP_API_BASE || "https://api.mercadopago.com";

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string
  ) {
    super(message);
  }
}

export function mercadoPagoConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new MercadoPagoError("Falta MP_ACCESS_TOKEN", 500, "");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Mercado Pago", res.status, path, text.slice(0, 500));
    throw new MercadoPagoError(`Mercado Pago ${res.status} en ${path}`, res.status, text.slice(0, 500));
  }
  return JSON.parse(text) as T;
}

export interface Preapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled" | "canceled";
  external_reference: string | null;
  preapproval_plan_id?: string | null;
  payer_email?: string | null;
  init_point?: string;
  next_payment_date?: string | null;
  auto_recurring?: {
    frequency: number;
    frequency_type: "days" | "months";
    transaction_amount: number;
    currency_id: string;
  };
}

export interface AuthorizedPayment {
  id: number;
  preapproval_id: string;
  external_reference: string | null;
  status: "scheduled" | "processed" | "recycling" | "canceled";
  transaction_amount: number;
  debit_date: string | null;
  retry_attempt?: number;
  payment?: { id: number; status: string; status_detail?: string } | null;
}

export async function createPreapproval(input: {
  reason: string;
  externalReference: string;
  payerEmail: string;
  frequencyMonths: number;
  amount: number;
  backUrl: string;
}): Promise<Preapproval> {
  return mp<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: input.frequencyMonths,
        frequency_type: "months",
        transaction_amount: input.amount,
        currency_id: "ARS",
      },
      back_url: input.backUrl,
      status: "pending",
    }),
  });
}

export interface PreapprovalPlan {
  id: string;
  external_reference: string | null;
  init_point?: string;
}

/**
 * Crea un plan de suscripción para un cobro puntual (un negocio, un plan,
 * un ciclo) y devuelve su link de checkout. A diferencia de la suscripción
 * "sin plan asociado", no hace falta saber de antemano el email de Mercado
 * Pago: la persona entra al checkout y paga con tarjeta o iniciando sesión.
 * La suscripción que se crea al pagar trae preapproval_plan_id, y el plan
 * guarda nuestra external_reference.
 */
export async function createPreapprovalPlan(input: {
  reason: string;
  externalReference: string;
  frequencyMonths: number;
  amount: number;
  backUrl: string;
}): Promise<PreapprovalPlan> {
  return mp<PreapprovalPlan>("/preapproval_plan", {
    method: "POST",
    body: JSON.stringify({
      reason: input.reason,
      external_reference: input.externalReference,
      auto_recurring: {
        frequency: input.frequencyMonths,
        frequency_type: "months",
        transaction_amount: input.amount,
        currency_id: "ARS",
      },
      back_url: input.backUrl,
    }),
  });
}

export function getPreapprovalPlan(id: string): Promise<PreapprovalPlan> {
  return mp<PreapprovalPlan>(`/preapproval_plan/${encodeURIComponent(id)}`);
}

/** Suscripciones que se crearon pagando el checkout de un plan. */
export async function searchPreapprovalsByPlan(planId: string): Promise<Preapproval[]> {
  const res = await mp<{ results?: Preapproval[] }>(
    `/preapproval/search?preapproval_plan_id=${encodeURIComponent(planId)}`
  );
  return res.results ?? [];
}

export interface Payment {
  id: number;
  status: "approved" | "pending" | "in_process" | "authorized" | "rejected" | "cancelled" | "refunded" | "charged_back";
  external_reference: string | null;
  transaction_amount: number;
  date_approved: string | null;
}

/**
 * Pago único (Checkout Pro): un mes o un año del plan, sin renovación
 * automática. Acepta tarjeta, dinero en cuenta y efectivo.
 */
export async function createPreference(input: {
  title: string;
  externalReference: string;
  amount: number;
  backUrl: string;
}): Promise<{ id: string; init_point?: string; sandbox_init_point?: string }> {
  return mp("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [{ id: "plan", title: input.title, quantity: 1, unit_price: input.amount, currency_id: "ARS" }],
      external_reference: input.externalReference,
      back_urls: { success: input.backUrl, pending: input.backUrl, failure: input.backUrl },
      auto_return: "approved",
      statement_descriptor: "PESITO",
    }),
  });
}

export function getPayment(id: string): Promise<Payment> {
  return mp<Payment>(`/v1/payments/${encodeURIComponent(id)}`);
}

export async function searchPaymentsByReference(ref: string): Promise<Payment[]> {
  const res = await mp<{ results?: Payment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc`
  );
  return res.results ?? [];
}

/** Con credenciales de prueba, Mercado Pago usa el link de sandbox. */
export function usingTestCredentials(): boolean {
  return (process.env.MP_ACCESS_TOKEN ?? "").startsWith("TEST-");
}

/** El mensaje de error que devolvió Mercado Pago, para mostrarlo. */
export function mercadoPagoErrorMessage(e: unknown): string | null {
  if (!(e instanceof MercadoPagoError)) return null;
  try {
    const body = JSON.parse(e.body) as { message?: string; error?: string };
    return body.message || body.error || null;
  } catch {
    return e.body || null;
  }
}

export function getPreapproval(id: string): Promise<Preapproval> {
  return mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);
}

export function getAuthorizedPayment(id: string): Promise<AuthorizedPayment> {
  return mp<AuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`);
}

/** Cancela la suscripción (irreversible en Mercado Pago). */
export async function cancelPreapproval(id: string): Promise<void> {
  try {
    await mp(`/preapproval/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });
  } catch (e) {
    // La documentación nombra el estado con una sola "l"; la API usa dos.
    if (e instanceof MercadoPagoError && e.status === 400) {
      await mp(`/preapproval/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ status: "canceled" }),
      });
      return;
    }
    throw e;
  }
}

/**
 * Verifica la firma de un aviso (webhook) de Mercado Pago:
 * HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;").
 * Sin MP_WEBHOOK_SECRET configurado devuelve null (no se puede verificar);
 * igual, el aviso sólo dispara una consulta a la API con nuestro token,
 * que es la fuente de verdad.
 */
export function verifyWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean | null {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return null;
  if (!input.xSignature) return false;

  const parts = Object.fromEntries(
    input.xSignature.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let manifest = "";
  if (input.dataId) manifest += `id:${input.dataId.toLowerCase()};`;
  if (input.xRequestId) manifest += `request-id:${input.xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
