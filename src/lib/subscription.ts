import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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
