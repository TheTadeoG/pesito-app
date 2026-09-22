import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** user_id -> usuario#código o email real, para mostrar quién es quién. */
export async function getMemberLabelsById(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("memberships")
    .select("user_id, username, email")
    .eq("org_id", orgId);

  return new Map((data ?? []).map((m) => [m.user_id, m.username ?? m.email ?? "Usuario eliminado"]));
}

export function memberLabelFor(
  targetUserId: string,
  currentUserId: string,
  labelsById: Map<string, string>
): string {
  if (targetUserId === currentUserId) return "Vos";
  return labelsById.get(targetUserId) ?? "Usuario eliminado";
}
