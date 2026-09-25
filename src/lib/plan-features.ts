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
    // Pocas y cortas a propósito (sólo el Plan Gratis): la tarjeta tiene que
    // verse simple. Todo lo que incluye está en /comparar-planes y en las
    // preguntas frecuentes.
    features: [
      FREE_PLAN_SALES_LIMIT_LABEL,
      "Caja diaria y fiado",
      "Stock y compras a proveedores",
      "Reportes básicos de ventas",
      "1 usuario y 1 caja",
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
      "Control de stock, alertas y reposición",
      "Cuentas corrientes de clientes y proveedores",
      "Control de caja por empleado",
      "Hasta 2 usuarios y 2 cajas",
    ],
    soon: ["Talles, combos y kits"],
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
      "Aumentos masivos de precios en segundos",
      "Reportes avanzados",
      "Mirá el negocio en vivo, desde casa, en tu celular",
      "Hasta 6 usuarios y 6 cajas",
      "Soporte prioritario",
    ],
    soon: [
      "Control por usuario: qué puede ver y hacer cada uno",
      "Inventarios físicos",
      "Balanzas conectadas",
      "Carteles de precios para imprimir",
      "1 catálogo online",
      "Ofertas y promociones",
    ],
  },
  ia: {
    plan: "ia",
    name: "Plan IA",
    price: 28000,
    priceLabel: "$28.000",
    period: "por mes · IVA incl.",
    badge: "Nuevo",
    features: [
      "Todas las funciones del Plan Pro +",
      "Hasta 2 sucursales, cada una con su stock",
      "Soporte prioritario 24/7",
    ],
    soon: [
      "Ganancias por sucursal",
      "Reportes avanzados con IA",
      "Sugerencia de precios",
      "Análisis de competencia y mercado",
      "Qué reponer y cuándo",
      "Productos que no rotan",
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

/** Valor de una celda de la comparación: incluido, no incluido o un texto. */
export type ComparisonValue = boolean | string;

export interface ComparisonRow {
  label: string;
  values: Record<Plan, ComparisonValue>;
}

const everyPlan: Record<Plan, ComparisonValue> = { gratis: true, esencial: true, pro: true, ia: true };
const fromEsencial: Record<Plan, ComparisonValue> = { gratis: false, esencial: true, pro: true, ia: true };
const onlyIa: Record<Plan, ComparisonValue> = { gratis: false, esencial: false, pro: false, ia: true };
const fromPro: Record<Plan, ComparisonValue> = { gratis: false, esencial: false, pro: true, ia: true };

// Tabla de /comparar-planes, agrupada por tema. Tiene que decir lo mismo que
// las features de cada plan de arriba: si cambia una, cambiar la otra.
export const planComparison: { title: string; rows: ComparisonRow[] }[] = [
  {
    title: "Límites",
    rows: [
      {
        label: "Ventas por mes",
        values: { gratis: "150", esencial: "Ilimitadas", pro: "Ilimitadas", ia: "Ilimitadas" },
      },
      { label: "Usuarios", values: { gratis: "1", esencial: "2", pro: "6", ia: "6" } },
      { label: "Cajas", values: { gratis: "1", esencial: "2", pro: "6", ia: "6" } },
      { label: "Sucursales", values: { gratis: "1", esencial: "1", pro: "1", ia: "2" } },
    ],
  },
  {
    title: "Vender",
    rows: [
      { label: "Punto de venta con lector de código de barras", values: everyPlan },
      { label: "Venta por unidad o por peso", values: everyPlan },
      { label: "Efectivo, tarjeta, transferencia, QR y pago mixto", values: everyPlan },
      { label: "Ticket de venta (no fiscal)", values: everyPlan },
      {
        label: "Balanzas conectadas",
        values: { gratis: false, esencial: false, pro: "Pronto", ia: "Pronto" },
      },
      {
        label: "Carteles de precios para imprimir, siempre actualizados",
        values: { gratis: false, esencial: false, pro: "Pronto", ia: "Pronto" },
      },
      {
        label: "Catálogo online",
        values: { gratis: false, esencial: false, pro: "Pronto (1)", ia: "Pronto (1)" },
      },
      {
        label: "Combos y kits",
        values: { gratis: false, esencial: "Pronto", pro: "Pronto", ia: "Pronto" },
      },
      {
        label: "Talles y colores (variantes)",
        values: { gratis: false, esencial: "Pronto", pro: "Pronto", ia: "Pronto" },
      },
      {
        label: "Ofertas y promociones",
        values: { gratis: false, esencial: false, pro: "Pronto", ia: "Pronto" },
      },
    ],
  },
  {
    title: "Stock, precios y compras",
    rows: [
      { label: "Stock que se actualiza con cada venta y compra", values: everyPlan },
      { label: "Stock mínimo, aviso de faltantes y lista para reponer", values: fromEsencial },
      { label: "Historial de movimientos de stock", values: fromEsencial },
      {
        label: "Inventarios físicos: contás y el stock se ajusta solo",
        values: { gratis: false, esencial: false, pro: "Pronto", ia: "Pronto" },
      },
      { label: "Compras a proveedores", values: everyPlan },
      { label: "Historial de precios de cada producto", values: everyPlan },
      { label: "Cuenta corriente con proveedores", values: fromEsencial },
      { label: "Aumentos masivos de precios y costos, con deshacer", values: fromPro },
      { label: "Pases de mercadería entre sucursales", values: onlyIa },
    ],
  },
  {
    title: "Caja, clientes y equipo",
    rows: [
      { label: "Caja diaria con cierre y arqueo", values: everyPlan },
      { label: "Clientes con fiado (cuenta corriente)", values: everyPlan },
      { label: "En vivo: ventas del momento por sucursal y vendedor", values: fromPro },
      { label: "Ventas y diferencias de caja por empleado", values: fromEsencial },
      { label: "Historial completo de caja", values: fromPro },
      {
        label: "Control por usuario: permisos de qué puede ver y hacer cada uno",
        values: { gratis: false, esencial: false, pro: "Pronto", ia: "Pronto" },
      },
    ],
  },
  {
    title: "Reportes",
    rows: [
      { label: "Ventas, ticket promedio, medios de pago y más vendidos", values: everyPlan },
      { label: "Ganancias: qué te deja más plata y qué vendés a pérdida", values: fromPro },
      { label: "Comparación con el período anterior", values: fromPro },
      {
        label: "Ganancias separadas por sucursal",
        values: { gratis: false, esencial: false, pro: false, ia: "Pronto" },
      },
    ],
  },
  {
    title: "Soporte e inteligencia artificial",
    rows: [
      { label: "Soporte prioritario", values: { gratis: false, esencial: false, pro: true, ia: "24/7" } },
      ...[
        "Reportes avanzados con IA",
        "Sugerencia de precios",
        "Análisis de competidores y del mercado",
        "Recomendaciones de reposición",
        "Detección de productos de baja rotación",
      ].map((label) => ({
        label,
        values: { gratis: false, esencial: false, pro: false, ia: "Pronto" } as Record<Plan, ComparisonValue>,
      })),
    ],
  },
];
