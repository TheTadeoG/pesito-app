import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { argDateString, argMidnightUTC } from "@/lib/timezone";

export type Plan = "gratis" | "esencial" | "pro" | "ia";

export const planLabels: Record<Plan, string> = {
  gratis: "Gratis",
  esencial: "Esencial",
  pro: "Pro",
  ia: "IA",
};

// Mismos planes y orden que la página de precios (src/components/marketing/pricing.tsx).
export const planOrder: Plan[] = ["gratis", "esencial", "pro", "ia"];

export interface SubscriptionInfo {
  plan: Plan;
  proTrialEndsAt: string | null;
  /** El negocio tiene funciones Pro activas ahora: por plan pago o por prueba vigente. */
  hasProAccess: boolean;
  /** Está en plan gratis y todavía le queda tiempo de prueba Pro. */
  trialActive: boolean;
}

/**
 * Trae el plan del negocio. Si por algún motivo no hay fila todavía (no
 * debería pasar tras la migración 0026, que hace backfill), se asume
 * "gratis" sin prueba en vez de romper la página.
 */
export async function getSubscription(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SubscriptionInfo> {
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("plan, pro_trial_ends_at")
    .eq("org_id", orgId)
    .maybeSingle();

  const plan: Plan = data?.plan ?? "gratis";
  const proTrialEndsAt = data?.pro_trial_ends_at ?? null;
  const trialActive =
    plan === "gratis" && proTrialEndsAt !== null && new Date(proTrialEndsAt) > new Date();

  return {
    plan,
    proTrialEndsAt,
    hasProAccess: plan === "pro" || plan === "ia" || trialActive,
    trialActive,
  };
}

// El plan gratis, una vez pasada la prueba Pro, queda limitado a esta
// cantidad de ventas por mes calendario — el resto de los límites por plan
// se van a ir definiendo más adelante.
export const FREE_PLAN_MONTHLY_SALES_LIMIT = 150;

/** Ventas completadas en lo que va del mes calendario (huso Argentina). */
export async function getMonthlySalesCount(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<number> {
  const [year, month] = argDateString().split("-");
  const monthStart = argMidnightUTC(`${year}-${month}-01`);

  const { count } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "completada")
    .gte("created_at", monthStart.toISOString());

  return count ?? 0;
}
