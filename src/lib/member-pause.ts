import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSubscription, type SubscriptionInfo } from "@/lib/subscription";
import { limitsFor } from "@/lib/plan-access";

// Usuarios de más para el plan (p. ej. después de bajar de plan y pasados
// los 7 días de gracia): quedan pausados los últimos que se sumaron; el
// dueño nunca. Para reactivarlos, el dueño pasa a un plan con más usuarios
// o quita a otros del equipo. La prueba Pro y la gracia cuentan con el plan
// que vale en ese momento (limitsFor).

interface MemberRow {
  id: string;
  role: string;
  created_at: string;
}

/** Ids de membresía pausados, en orden: dueño primero, después por antigüedad. */
export function pausedMembershipIds(members: MemberRow[], limit: number): Set<string> {
  const ordered = [...members].sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (b.role === "owner" && a.role !== "owner") return 1;
    return a.created_at.localeCompare(b.created_at);
  });
  return new Set(ordered.slice(Math.max(limit, 1)).filter((m) => m.role !== "owner").map((m) => m.id));
}

/** ¿Esta membresía está pausada por el límite de usuarios del plan? */
export async function isMembershipPaused(
  supabase: SupabaseClient<Database>,
  orgId: string,
  membershipId: string,
  subscription?: SubscriptionInfo
): Promise<boolean> {
  // Lo común (pocos usuarios) resuelve con un conteo.
  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if ((count ?? 0) <= 1) return false;
  const sub = subscription ?? (await getSubscription(supabase, orgId));
  const limit = limitsFor(sub).users;
  if ((count ?? 0) <= limit) return false;
  const { data } = await supabase.from("memberships").select("id, role, created_at").eq("org_id", orgId);
  return pausedMembershipIds((data ?? []) as MemberRow[], limit).has(membershipId);
}
