"use server";

import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

/** Marca un error como resuelto (si vuelve a pasar, se reabre y avisa de nuevo) o lo reabre. */
export async function setErrorStatus(id: string, status: "new" | "resolved"): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  if (status !== "new" && status !== "resolved") return { error: "Estado inválido." };
  const { error } = await createAdminClient().from("app_errors").update({ status }).eq("id", id);
  return error ? { error: "No pudimos guardar el cambio." } : {};
}

/** Borra los ya resueltos de hace más de 30 días (no hace falta guardarlos). */
export async function deleteOldResolvedErrors(): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await createAdminClient().from("app_errors").delete().eq("status", "resolved").lt("last_seen_at", before);
  return error ? { error: "No pudimos borrarlos." } : {};
}
