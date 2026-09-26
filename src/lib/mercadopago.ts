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
    throw new MercadoPagoError(`Mercado Pago ${res.status} en ${path}`, res.status, text.slice(0, 500));
  }
  return JSON.parse(text) as T;
}

export interface Preapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled" | "canceled";
  external_reference: string | null;
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
