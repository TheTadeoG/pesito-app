import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSubscription, planLabels } from "@/lib/subscription";
import { limitsFor, planForLimit, type PlanLimits } from "@/lib/plan-access";

// Controles de los límites de cada plan (lib/plan-access.ts) antes de crear
// algo nuevo. Devuelven el mensaje para mostrar, o null si se puede.

function limitMessage(key: keyof PlanLimits, limit: number, what: string): string {
  const next = planForLimit(key, limit + 1);
  const upgrade = next
    ? ` Para sumar más, pasá al Plan ${planLabels[next]}.`
    : " Si necesitás más, escribinos por WhatsApp.";
  return `Tu plan incluye hasta ${limit} ${what}.${upgrade}`;
}

/** Usuarios del negocio + invitaciones pendientes (cada una es un usuario más). */
export async function checkUserLimit(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<string | null> {
  const [subscription, { count: members }, { count: invitations }] = await Promise.all([
    getSubscription(supabase, orgId),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  const limit = limitsFor(subscription).users;
  if ((members ?? 0) + (invitations ?? 0) < limit) return null;
  return limitMessage("users", limit, limit === 1 ? "usuario" : "usuarios");
}

/** Cajas abiertas a la vez en todo el negocio. */
export async function checkOpenRegisterLimit(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<string | null> {
  const [subscription, { count }] = await Promise.all([
    getSubscription(supabase, orgId),
    supabase
      .from("cash_registers")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "abierta"),
  ]);
  const limit = limitsFor(subscription).openRegisters;
  if ((count ?? 0) < limit) return null;
  return limitMessage("openRegisters", limit, limit === 1 ? "caja abierta a la vez" : "cajas abiertas a la vez");
}

export async function checkBranchLimit(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<string | null> {
  const [subscription, { count }] = await Promise.all([
    getSubscription(supabase, orgId),
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);
  const limit = limitsFor(subscription).branches;
  if ((count ?? 0) < limit) return null;
  return limitMessage("branches", limit, limit === 1 ? "sucursal" : "sucursales");
}
