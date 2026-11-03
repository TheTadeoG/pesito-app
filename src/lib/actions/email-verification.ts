"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { checkIpRateLimit } from "@/lib/ip-rate-limit";

/** Reenvía el email para confirmar la cuenta (la confirmación se pide después de crearla, con un recordatorio). */
export async function resendConfirmationEmail(): Promise<{ error?: string; sent?: boolean }> {
  const { email, emailUnverified } = await requireOrgContext();
  if (!email || !emailUnverified) return { sent: true };
  const limited = await checkIpRateLimit("reenviar_confirmacion", 3, 10 * 60);
  if (limited) return { error: limited };
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/pos")}` },
  });
  if (error) {
    console.error("resendConfirmationEmail", (error as { code?: string }).code ?? "", error.message);
    return { error: "No pudimos enviar el email. Probá de nuevo en unos minutos." };
  }
  return { sent: true };
}
