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

export type BillingCycle = "mensual" | "anual";
export type PaymentStatus = "active" | "past_due" | "cancelled";

export interface BillingInfo {
  /** Plan contratado (puede no valer más si venció la gracia o el período). */
  paidPlan: Plan;
  cycle: BillingCycle | null;
  status: PaymentStatus | null;
  mpPreapprovalId: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  payerEmail: string | null;
}

export interface SubscriptionInfo {
  /** Plan que vale hoy (misma regla que org_effective_plan en la base, 0047). */
  plan: Plan;
  proTrialEndsAt: string | null;
  /** El negocio tiene funciones Pro activas ahora: por plan pago o por prueba vigente. */
  hasProAccess: boolean;
  /** Está en plan gratis y todavía le queda tiempo de prueba Pro. */
  trialActive: boolean;
  /** Cobro con Mercado Pago (null sin la migración 0047 o sin suscripción). */
  billing: BillingInfo | null;
}

type SubscriptionRow = {
  plan: Plan;
  pro_trial_ends_at: string | null;
  billing_cycle?: string | null;
  mp_preapproval_id?: string | null;
  payment_status?: string | null;
  current_period_end?: string | null;
  grace_until?: string | null;
  payer_email?: string | null;
};

/** Con un cobro fallido y la gracia vencida, o cancelada y el período terminado, vale Gratis. */
export function lapsedToFree(row: SubscriptionRow, now = new Date()): boolean {
  if (row.plan === "gratis") return false;
  if (row.payment_status === "past_due" && row.grace_until && new Date(row.grace_until) < now) return true;
  if (row.payment_status === "cancelled" && row.current_period_end && new Date(row.current_period_end) < now) {
    return true;
  }
  return false;
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
  // "*": con la migración 0047 trae también los datos del cobro; sin ella,
  // pedirlos por nombre haría fallar la consulta.
  const { data: raw } = await supabase
    .from("organization_subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  const data = raw as SubscriptionRow | null;

  const paidPlan: Plan = data?.plan ?? "gratis";
  const plan: Plan = data && lapsedToFree(data) ? "gratis" : paidPlan;
  const proTrialEndsAt = data?.pro_trial_ends_at ?? null;
  const trialActive =
    plan === "gratis" && proTrialEndsAt !== null && new Date(proTrialEndsAt) > new Date();

  return {
    plan,
    proTrialEndsAt,
    hasProAccess: plan === "pro" || plan === "ia" || trialActive,
    trialActive,
    billing:
      data && data.payment_status
        ? {
            paidPlan,
            cycle: (data.billing_cycle as BillingCycle | null) ?? null,
            status: data.payment_status as PaymentStatus,
            mpPreapprovalId: data.mp_preapproval_id ?? null,
            currentPeriodEnd: data.current_period_end ?? null,
            graceUntil: data.grace_until ?? null,
            payerEmail: data.payer_email ?? null,
          }
        : null,
  };
}

export interface PlanHistoryEntry {
  id: string;
  fromPlan: Plan;
  toPlan: Plan;
  createdAt: string;
}

/** Cambios de plan reales (no de pagos, que no existen sin pasarela conectada). */
export async function getPlanHistory(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<PlanHistoryEntry[]> {
  const { data } = await supabase
    .from("plan_history")
    .select("id, from_plan, to_plan, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    fromPlan: row.from_plan,
    toPlan: row.to_plan,
    createdAt: row.created_at,
  }));
}

// El plan gratis, una vez pasada la prueba Pro, queda limitado a esta
// cantidad de ventas por mes calendario — el resto de los límites por plan
// se van a ir definiendo más adelante.
export const FREE_PLAN_MONTHLY_SALES_LIMIT = 150;

/**
 * El tope de ventas por mes aplica sólo al Plan Gratis sin prueba vigente.
 * Cualquier plan pago (incluido Esencial) vende sin límite — antes se
 * miraba hasProAccess, y un negocio que pagaba Esencial quedaba con el
 * mismo tope que el gratis.
 */
export function hasMonthlySalesLimit(subscription: SubscriptionInfo): boolean {
  return subscription.plan === "gratis" && !subscription.trialActive;
}

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

/**
 * Plan pago sin renovación automática (pago único o débito cancelado) que
 * vence en los próximos 5 días: para avisar que hay que renovarlo.
 */
export function expiringPaidPlan(subscription: SubscriptionInfo): BillingInfo | null {
  const billing = subscription.billing;
  if (subscription.plan === "gratis" || billing?.status !== "cancelled" || !billing.currentPeriodEnd) return null;
  const left = new Date(billing.currentPeriodEnd).getTime() - Date.now();
  return left < 5 * 24 * 60 * 60 * 1000 ? billing : null;
}
