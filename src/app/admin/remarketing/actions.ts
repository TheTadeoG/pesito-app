"use server";

import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

/** Anota que se le escribió a un negocio (WhatsApp o mail) desde una lista de remarketing. */
export async function logContact(orgId: string, kind: "whatsapp" | "mail", audience: string): Promise<{ at?: string; error?: string }> {
  const { userId } = await requirePlatformAdmin();
  if (kind !== "whatsapp" && kind !== "mail") return { error: "Canal inválido." };
  const { data, error } = await createAdminClient()
    .from("admin_contacts")
    .insert({ org_id: orgId, kind, audience: audience.slice(0, 40), author_id: userId })
    .select("created_at")
    .single();
  if (error || !data) return { error: "No pudimos anotar el contacto (¿falta aplicar la migración 0092?)." };
  return { at: data.created_at };
}
