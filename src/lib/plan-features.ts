import type { Plan } from "@/lib/subscription";

// Descuento del ciclo anual sobre el precio mensual — usado tanto en la
// página de precios de la landing como en el checkout de /registro, para
// que el monto mostrado en los dos lugares nunca se desalinee.
export const ANNUAL_DISCOUNT = 0.2;

export interface PlanDefinition {
  plan: Plan;
  name: string;
  /** Precio mensual en ARS, IVA incluido. 0 para el plan gratis. */
  price: number;
  priceLabel: string;
  period: string;
  badge: string | null;
  features: string[];
  /** Funciones anunciadas que todavía no están disponibles ("Pronto"). */
  soon?: string[];
}

// Ver también FREE_PLAN_MONTHLY_SALES_LIMIT en lib/subscription.ts, que es
// el valor que realmente se valida al vender — éste es sólo para mostrarlo
// en el texto de abajo sin que se desalinee.
export const FREE_PLAN_SALES_LIMIT_LABEL = "150 ventas por mes";

// Fuente única de los planes: la usan tanto la página pública de precios
// (marketing/pricing.tsx, marketing/structured-data.tsx) como la sección
// de Suscripción del panel, para que nunca queden desalineados.
export const planDefinitions: Record<Plan, PlanDefinition> = {
  gratis: {
    plan: "gratis",
    name: "Plan Gratis",
    price: 0,
    priceLabel: "Gratis",
    period: "sin tarjeta",
    badge: null,
    // Cortas a propósito: la tarjeta de precios tiene que verse simple. El
    // detalle de cada función está en las preguntas frecuentes.
    features: [
      FREE_PLAN_SALES_LIMIT_LABEL,
      "Cobrá con lector de código de barras",
      "Stock con aviso de faltantes",
      "Caja y fiado siempre al día",
      "Aumentos de precios en un paso",
      "Reportes simples de tu negocio",
      "1 usuario",
    ],
  },
  esencial: {
    plan: "esencial",
    name: "Plan Esencial",
    price: 15000,
    priceLabel: "$15.000",
    period: "por mes · IVA incl.",
    badge: null,
    features: [
      "Todas las funciones del Plan Gratis +",
      "Ventas ilimitadas",
      "2 usuarios, cada uno con su caja",
    ],
  },
  pro: {
    plan: "pro",
    name: "Plan Pro",
    price: 25000,
    priceLabel: "$25.000",
    period: "por mes · IVA incl.",
    badge: "Más elegido",
    features: [
      "Todas las funciones del Plan Esencial +",
      "Varias sucursales, cada una con su stock",
      "Pasá mercadería entre sucursales",
      "Reportes avanzados",
      "Hasta 10 usuarios",
      "Soporte prioritario",
    ],
  },
  ia: {
    plan: "ia",
    name: "Plan IA",
    price: 28000,
    priceLabel: "$28.000",
    period: "por mes · IVA incl.",
    badge: "Nuevo",
    features: ["Todas las funciones del Plan Pro +", "Soporte prioritario 24/7"],
    soon: ["Qué reponer, sugerido con IA", "Productos que no se venden", "Precios sugeridos"],
  },
};

// Planes pagos, en el mismo orden que se muestran en la página de precios
// y en Configuración. El Plan Gratis (planDefinitions.gratis) se maneja
// aparte porque no tiene CTA de "pasarse" — es el punto de partida.
export const paidPlanDefinitions: PlanDefinition[] = [
  planDefinitions.esencial,
  planDefinitions.pro,
  planDefinitions.ia,
];

/**
 * Las funciones que suma un plan sobre el anterior (sin el "Todas las
 * funciones de X +" de encabezado). Se usa para enumerar, durante la
 * prueba Pro, cuáles de esas funciones son "de prestado" y van a dejar de
 * estar disponibles cuando termine.
 */
export function getPlanOwnFeatures(plan: Plan): string[] {
  return planDefinitions[plan].features.filter((f) => !f.startsWith("Todas las funciones"));
}
