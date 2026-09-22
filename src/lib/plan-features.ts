import type { Plan } from "@/lib/subscription";

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
    ],
  },
  esencial: {
    plan: "esencial",
    name: "Plan Esencial",
    price: 20000,
    priceLabel: "$20.000",
    period: "por mes · IVA incl.",
    badge: null,
    features: [
      "Todas las funciones del Plan Gratis +",
      "Hasta 2 usuarios",
      "Facturación de ARCA (costo adicional)",
    ],
  },
  pro: {
    plan: "pro",
    name: "Plan Pro",
    price: 35000,
    priceLabel: "$35.000",
    period: "por mes · IVA incl.",
    badge: "Más elegido",
    features: [
      "Todas las funciones del Plan Esencial +",
      "Reportes avanzados: períodos, gráficos y widgets",
      "Múltiples cajas y usuarios simultáneos",
      "Historial completo de caja (aperturas, cierres, diferencias)",
      "Hasta 10 usuarios",
      "Facturación de ARCA (costo adicional)",
      "Soporte prioritario",
    ],
  },
  ia: {
    plan: "ia",
    name: "Plan IA",
    price: 40000,
    priceLabel: "$40.000",
    period: "por mes · IVA incl.",
    badge: "Nuevo",
    features: [
      "Todas las funciones del Plan Pro +",
      "Recomendaciones de reposición con IA",
      "Detección de productos de baja rotación",
      "Precios sugeridos automáticamente",
      "Facturación de ARCA (costo adicional)",
      "Soporte prioritario 24/7",
    ],
  },
};

// Planes que se muestran en la sección pública de precios (el Gratis se
// promociona aparte, como "7 días de prueba" / "Empezar gratis").
export const paidPlanDefinitions: PlanDefinition[] = [
  planDefinitions.esencial,
  planDefinitions.pro,
  planDefinitions.ia,
];
