"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { sendEmail } from "@/lib/email";
import { roleLabels } from "@/lib/roles";
import { FEEDBACK_MAX, FEEDBACK_MIN, type FeedbackKind } from "@/lib/feedback";

export interface FeedbackResult {
  error?: string;
  ok?: boolean;
}

/**
 * Guarda una sugerencia o un reporte de problema del negocio (para todos los
 * planes). No revalida páginas. Si hay RESEND_API_KEY y FEEDBACK_NOTIFY_EMAIL,
 * además avisa por email; si falla el aviso, igual queda en la bandeja de /admin.
 */
export async function submitFeedback(input: {
  kind: FeedbackKind;
  message: string;
  page?: string;
}): Promise<FeedbackResult> {
  const { organization, membership, email } = await requireOrgContext();
  const message = (input.message ?? "").trim();
  if (input.kind !== "suggestion" && input.kind !== "problem") return { error: "Tipo de mensaje inválido." };
  if (message.length < FEEDBACK_MIN) return { error: "Contanos un poco más (al menos unas palabras)." };
  if (message.length > FEEDBACK_MAX) return { error: `Es muy largo: el máximo es ${FEEDBACK_MAX} caracteres.` };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_feedback", {
    p_org_id: organization.id,
    p_kind: input.kind,
    p_message: message,
    p_page: input.page?.slice(0, 200) ?? null,
  });
  if (error) {
    if (error.code === "P0429") {
      return { error: "Hoy ya mandaste varios mensajes. Si es urgente, escribinos por WhatsApp; si no, probá mañana." };
    }
    console.error("submit_feedback", error);
    return { error: "No pudimos enviarlo. Probá de nuevo en un rato." };
  }

  const to = process.env.FEEDBACK_NOTIFY_EMAIL;
  if (to) {
    const label = input.kind === "problem" ? "Problema" : "Sugerencia";
    await sendEmail({
      to,
      subject: `${label} de ${organization.name}`,
      text: [
        message,
        "",
        `Negocio: ${organization.name}`,
        `Quién: ${email ?? "sin email"} (${roleLabels[membership.role as keyof typeof roleLabels] ?? membership.role})`,
        `Pantalla: ${input.page ?? "—"}`,
        "",
        "Verlo en /admin/mensajes",
      ].join("\n"),
    });
  }
  return { ok: true };
}
