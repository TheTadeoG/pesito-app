import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { errorFingerprint, isIgnorableError, scrub } from "@/lib/error-fingerprint";

// Seguimiento de errores propio (migración 0076): agrupa por huella, cuenta las veces y avisa por
// mail cuando aparece un error NUEVO (o uno resuelto que vuelve). Sólo servidor. Nunca tira error:
// registrar un fallo no puede causar otro.

const MAX_EMAILS = 8; // por instancia del servidor y por ventana (si algo se rompe en cadena, no inunda)
const EMAIL_WINDOW_MS = 10 * 60 * 1000;
let emailTimes: number[] = [];

export interface LoggableError {
  source: "server" | "client";
  error: unknown;
  /** Ruta sin parámetros (ahí pasó). */
  path?: string | null;
  /** De dónde viene (render, acción, ruta, "client"…). */
  context?: string | null;
}

function toParts(error: unknown): { message: string; stack?: string; digest?: string } {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: unknown }).digest;
    return { message: error.message || error.name, stack: error.stack, digest: typeof digest === "string" ? digest : undefined };
  }
  if (error && typeof error === "object" && "message" in error) {
    const e = error as { message: unknown; stack?: unknown; digest?: unknown };
    return { message: String(e.message), stack: typeof e.stack === "string" ? e.stack : undefined, digest: typeof e.digest === "string" ? e.digest : undefined };
  }
  return { message: String(error) };
}

export async function logError(input: LoggableError): Promise<void> {
  try {
    const { message: rawMessage, stack: rawStack, digest } = toParts(input.error);
    if (!rawMessage || isIgnorableError(rawMessage)) return;
    const message = scrub(rawMessage, 500);
    const stack = rawStack ? scrub(rawStack, 2500) : null;
    const path = input.path ? scrub(input.path.split("?")[0], 200) : null;
    const context = [input.context, digest ? `digest ${digest}` : null].filter(Boolean).join(" · ") || null;

    const { data, error } = await createAdminClient().rpc("log_app_error", {
      p_fingerprint: errorFingerprint(input.source, rawMessage, rawStack),
      p_source: input.source,
      p_message: message,
      p_stack: stack,
      p_path: path,
      p_context: context,
    });
    if (error) {
      console.error("log_app_error:", error.message);
      return;
    }
    const row = data?.[0];
    if (row && (row.is_new || row.reopened)) await notify({ message, path, source: input.source, reopened: row.reopened, context });
  } catch (e) {
    console.error("logError:", e);
  }
}

async function notify(e: { message: string; path: string | null; source: string; reopened: boolean; context: string | null }) {
  const to = process.env.ERROR_ALERT_EMAIL || process.env.BILLING_ALERT_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL;
  if (!to) return;
  const now = Date.now();
  emailTimes = emailTimes.filter((t) => now - t < EMAIL_WINDOW_MS);
  if (emailTimes.length >= MAX_EMAILS) return;
  emailTimes.push(now);
  await sendEmail({
    to,
    subject: `${e.reopened ? "Volvió un error" : "Error nuevo"} en Pesito: ${e.message.slice(0, 80)}`,
    text: [
      e.message,
      "",
      `Dónde: ${e.path ?? "—"} (${e.source === "server" ? "servidor" : "navegador"})`,
      e.context ? `Contexto: ${e.context}` : null,
      e.reopened ? "Estaba marcado como resuelto y volvió a pasar." : "Es la primera vez que aparece.",
      "",
      "Verlo y marcarlo como resuelto: /admin/errores",
      "Los siguientes avisos de este mismo error no se mandan por mail; el contador sube en el panel.",
    ]
      .filter((l) => l !== null)
      .join("\n"),
  });
}
