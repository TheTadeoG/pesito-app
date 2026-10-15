import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import type { Json } from "@/lib/database.types";

// Aviso interno cuando falla algo del cobro con Mercado Pago (hoy sólo el
// webhook). Queda anotado en billing_events (topic "alert", sin negocio) y,
// si hay RESEND_API_KEY y un destino (BILLING_ALERT_EMAIL, o
// FEEDBACK_NOTIFY_EMAIL si no está), llega por mail. Un mail por tipo de
// falla cada 30 minutos: si Mercado Pago reintenta o alguien manda basura
// al webhook, no se llena la casilla. Nunca tira error: avisar no puede
// romper la respuesta al webhook.
const WINDOW_MS = 30 * 60 * 1000;

export type BillingAlertKind = "webhook_error" | "webhook_firma";

const subjects: Record<BillingAlertKind, string> = {
  webhook_error: "Falló el webhook de Mercado Pago",
  webhook_firma: "Firma inválida en el webhook de Mercado Pago",
};

export async function alertBilling(kind: BillingAlertKind, detail: Record<string, unknown>) {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await admin
      .from("billing_events")
      .select("id", { count: "exact", head: true })
      .eq("topic", "alert")
      .eq("status", kind)
      .gte("created_at", since);

    await admin.from("billing_events").insert({
      org_id: null,
      topic: "alert",
      mp_id: String(detail.dataId ?? kind),
      status: kind,
      amount: null,
      detail: detail as Json,
    });
    if ((count ?? 0) > 0) return;

    const to = process.env.BILLING_ALERT_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL;
    if (!to) return;
    await sendEmail({
      to,
      subject: subjects[kind],
      text: [
        subjects[kind],
        "",
        ...Object.entries(detail).map(([k, v]) => `${k}: ${String(v)}`),
        "",
        kind === "webhook_firma"
          ? "Revisá que MP_WEBHOOK_SECRET sea la clave del webhook de producción (Mercado Pago → tu app → Webhooks)."
          : "Mercado Pago reintenta solo. Si sigue, mirá los logs de Vercel y la tabla billing_events.",
        "No se repite el aviso por 30 minutos.",
      ].join("\n"),
    });
  } catch (e) {
    console.error("alertBilling", e);
  }
}
