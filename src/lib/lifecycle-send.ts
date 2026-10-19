import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sendEmail } from "@/lib/email";
import { planDefinitions } from "@/lib/plan-features";
import { siteUrl } from "@/lib/utils";
import { renderLifecycleEmail } from "@/lib/lifecycle-templates";
import type { Pick } from "@/lib/lifecycle";

// Mandar un correo automático y anotarlo (migración 0077). Sólo servidor, con la service role.

const SUPPORT = "soporte@pesito.com.ar";

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return s;
}

/** Firma del link de baja: sin esto, cualquiera podría dar de baja a cualquier negocio. */
export function unsubscribeToken(orgId: string): string {
  return createHmac("sha256", secret()).update(`lifecycle-baja:${orgId}`).digest("hex");
}

export function verifyUnsubscribeToken(orgId: string, token: string): boolean {
  try {
    const expected = Buffer.from(unsubscribeToken(orgId));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export function unsubscribeUrl(orgId: string): string {
  return `${siteUrl}/api/lifecycle/baja?o=${orgId}&t=${unsubscribeToken(orgId)}`;
}

const planInfo = (plan: "esencial" | "pro") => ({
  name: planDefinitions[plan].name,
  priceLabel: planDefinitions[plan].priceLabel,
  promoLabel: planDefinitions[plan].promoLabel,
});

/** Manda el correo y, si salió, lo anota. Devuelve si se mandó (sin RESEND_API_KEY, no). */
export async function sendLifecycle(
  admin: SupabaseClient<Database>,
  input: { orgId: string; orgName: string; ownerEmail: string; pick: Pick; trialEndsAt?: string | null; graceUntil?: string | null }
): Promise<boolean> {
  const { subject, text } = renderLifecycleEmail(input.pick.template, {
    orgName: input.orgName,
    siteUrl,
    unsubscribeUrl: unsubscribeUrl(input.orgId),
    plans: { esencial: planInfo("esencial"), pro: planInfo("pro") },
    trialEndsAt: input.trialEndsAt,
    graceUntil: input.graceUntil,
  });
  const ok = await sendEmail({ to: input.ownerEmail, subject, text, replyTo: SUPPORT });
  if (!ok) return false;
  const { error } = await admin.from("lifecycle_emails").insert({ org_id: input.orgId, kind: input.pick.kind });
  // 23505: ya estaba anotado (dos tareas a la vez): no es un error.
  if (error && error.code !== "23505") console.error("lifecycle_emails:", error.message);
  return true;
}

/**
 * Bienvenida en el momento del alta (la tarea diaria la manda igual si ésta falla). Nunca tira
 * error: el alta no puede depender de un correo.
 */
export async function sendWelcome(admin: SupabaseClient<Database>, slug: string, ownerEmail: string | undefined): Promise<void> {
  try {
    if (!ownerEmail) return;
    const { data: org } = await admin.from("organizations").select("id, name").eq("slug", slug).maybeSingle();
    if (!org) return;
    const [{ data: sent }, { data: optout }] = await Promise.all([
      admin.from("lifecycle_emails").select("kind").eq("org_id", org.id).eq("kind", "welcome").maybeSingle(),
      admin.from("lifecycle_optout").select("org_id").eq("org_id", org.id).maybeSingle(),
    ]);
    if (sent || optout) return;
    await sendLifecycle(admin, { orgId: org.id, orgName: org.name, ownerEmail, pick: { kind: "welcome", template: "welcome" } });
  } catch (e) {
    console.error("sendWelcome:", e);
  }
}
