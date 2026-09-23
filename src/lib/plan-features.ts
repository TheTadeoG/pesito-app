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
}

// Ver también FREE_PLAN_MONTHLY_SALES_LIMIT en lib/subscription.ts, que es
// el valor que realmente se valida al vender — éste es sólo para mostrarlo
// en el texto de abajo sin que se desalinee.
export const FREE_PLAN_SALES_LIMIT_LABEL = "Hasta 150 ventas por mes";

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
    features: [
      "Ventas rápidas con lector de código de barras o teclado",
      "Productos por unidad, peso y variantes",
      "Stock: sumar, restar y ajustar a cantidad exacta",
      "Caja diaria con arqueo y diferencias",
      "Clientes y cuentas corrientes (fiado)",
      "Reportes de ventas e ingresos",
      "1 usuario",
      FREE_PLAN_SALES_LIMIT_LABEL,
    ],
  },
  esencial: {
    plan: "esencial",
    name: "Plan Esencial",
    price: 17000,
    priceLabel: "$17.000",
    period: "por mes · IVA incl.",
    badge: null,
    features: ["Todas las funciones del Plan Gratis +", "Hasta 2 usuarios"],
  },
  pro: {
    plan: "pro",
    name: "Plan Pro",
    price: 30000,
    priceLabel: "$30.000",
    period: "por mes · IVA incl.",
    badge: "Más elegido",
    features: [
      "Todas las funciones del Plan Esencial +",
      "Reportes avanzados: períodos, gráficos y widgets",
      "Múltiples cajas y usuarios simultáneos",
      "Historial completo de caja (aperturas, cierres, diferencias)",
      "Hasta 10 usuarios",
      "Soporte prioritario",
    ],
  },
  ia: {
    plan: "ia",
    name: "Plan IA",
    price: 35000,
    priceLabel: "$35.000",
    period: "por mes · IVA incl.",
    badge: "Nuevo",
    features: [
      "Todas las funciones del Plan Pro +",
      "Recomendaciones de reposición con IA",
      "Detección de productos de baja rotación",
      "Precios sugeridos automáticamente",
      "Soporte prioritario 24/7",
    ],
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
