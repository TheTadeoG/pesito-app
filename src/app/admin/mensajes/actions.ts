"use server";

import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type FeedbackStatus = "new" | "seen" | "done";

/** Cambia el estado de un mensaje de la bandeja. El cliente actualiza la lista (sin revalidar). */
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  if (!["new", "seen", "done"].includes(status)) return { error: "Estado inválido." };
  const { error } = await createAdminClient().from("feedback").update({ status }).eq("id", id);
  return error ? { error: "No pudimos guardar el cambio." } : {};
}

export async function deleteFeedback(id: string): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const { error } = await createAdminClient().from("feedback").delete().eq("id", id);
  return error ? { error: "No pudimos borrarlo." } : {};
}
