import { planLabels, planOrder, type Plan, type SubscriptionInfo } from "@/lib/subscription";

// Fuente única de QUÉ puede usar cada plan dentro del sistema. Toda función
// nueva que no sea para todos los planes se agrega acá (y en los textos de
// lib/plan-features.ts, que la describen en la web pública).

export type PlanFeature =
  | "stockManagement"
  | "supplierAccounts"
  | "bulkPriceChanges"
  | "profitReports"
  | "liveView"
  | "teamReports"
  | "cashHistory"
  | "branches"
  // Todavía no existen ("Pronto" en los planes): ya quedan con su plan para
  // que, al construirlas, se controlen con canUse desde el primer día.
  | "productBundles"
  | "productVariants"
  | "promotions"
  | "scales"
  | "onlineCatalog"
  | "priceSuggestions"
  | "marketAnalysis"
  | "restockRecommendations"
  | "lowRotation";

/** Plan mínimo que habilita cada función (los planes superiores la heredan). */
export const featureMinPlan: Record<PlanFeature, Plan> = {
  stockManagement: "esencial",
  supplierAccounts: "esencial",
  bulkPriceChanges: "pro",
  profitReports: "pro",
  liveView: "pro",
  teamReports: "esencial",
  cashHistory: "pro",
  branches: "pro",
  productBundles: "esencial",
  productVariants: "esencial",
  promotions: "pro",
  scales: "pro",
  onlineCatalog: "pro",
  priceSuggestions: "ia",
  marketAnalysis: "ia",
  restockRecommendations: "ia",
  lowRotation: "ia",
};

/** Nombre de la función para los avisos ("… está en el Plan Pro"). */
export const featureLabels: Record<PlanFeature, string> = {
  stockManagement: "La gestión de stock y reposición",
  supplierAccounts: "La cuenta corriente con proveedores",
  bulkPriceChanges: "Los aumentos masivos de precios y costos",
  profitReports: "Los reportes avanzados de ganancias",
  liveView: "La pantalla En vivo",
  teamReports: "Los reportes por empleado",
  cashHistory: "El historial completo de caja",
  branches: "Las sucursales",
  productBundles: "Los combos y kits",
  productVariants: "Los talles y colores",
  promotions: "Las ofertas y promociones",
  scales: "Las balanzas conectadas",
  onlineCatalog: "El catálogo online",
  priceSuggestions: "La sugerencia de precios",
  marketAnalysis: "El análisis de competidores y del mercado",
  restockRecommendations: "Las recomendaciones de reposición",
  lowRotation: "La detección de productos de baja rotación",
};

export interface PlanLimits {
  users: number;
  /** Cajas abiertas a la vez en todo el negocio. */
  openRegisters: number;
  branches: number;
}

export const planLimits: Record<Plan, PlanLimits> = {
  gratis: { users: 1, openRegisters: 1, branches: 1 },
  esencial: { users: 2, openRegisters: 2, branches: 1 },
  pro: { users: 6, openRegisters: 6, branches: 2 },
  ia: { users: 6, openRegisters: 6, branches: 2 },
};

/** Plan con el que funciona hoy el negocio: la prueba Pro cuenta como Pro. */
export function effectivePlan(subscription: Pick<SubscriptionInfo, "plan" | "trialActive">): Plan {
  return subscription.trialActive ? "pro" : subscription.plan;
}

function atLeast(plan: Plan, min: Plan): boolean {
  return planOrder.indexOf(plan) >= planOrder.indexOf(min);
}

export function canUse(
  subscription: Pick<SubscriptionInfo, "plan" | "trialActive">,
  feature: PlanFeature
): boolean {
  return atLeast(effectivePlan(subscription), featureMinPlan[feature]);
}

export function limitsFor(subscription: Pick<SubscriptionInfo, "plan" | "trialActive">): PlanLimits {
  return planLimits[effectivePlan(subscription)];
}

/** "Los aumentos masivos de precios y costos están en el Plan Pro." */
export function featureLockedMessage(feature: PlanFeature): string {
  const label = featureLabels[feature];
  const verb = label.startsWith("Los ") || label.startsWith("Las ") ? "están" : "está";
  return `${label} ${verb} en el Plan ${planLabels[featureMinPlan[feature]]}.`;
}

/** Plan más barato que permite `count` de ese límite (null si ninguno). */
export function planForLimit(key: keyof PlanLimits, count: number): Plan | null {
  return planOrder.find((p) => planLimits[p][key] >= count) ?? null;
}
