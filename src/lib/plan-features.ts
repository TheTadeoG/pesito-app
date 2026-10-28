import type { Plan } from "@/lib/subscription";

// Descuento del ciclo anual sobre el precio mensual — usado tanto en la
// página de precios de la landing como en el checkout de /registro, para
// que el monto mostrado en los dos lugares nunca se desalinee.
export const ANNUAL_DISCOUNT = 0.2;

/**
 * Promo de lanzamiento: el primer mes de un plan pago, pagando mensual, sale
 * `promoPrice` (quien nunca pagó un plan). Después, el precio normal. El
 * anual no tiene esta promo (ya tiene el 20% menos).
 */
export function promoText(def: PlanDefinition): string | null {
  return def.promoPrice && def.promoLabel ? `Primer mes ${def.promoLabel}, después ${def.priceLabel}` : null;
}

export interface PlanDefinition {
  plan: Plan;
  name: string;
  /** Precio mensual en ARS, IVA incluido. 0 para el plan gratis. */
  price: number;
  priceLabel: string;
  /** Promo de lanzamiento: el primer mes (pago mensual) a este precio. */
  promoPrice?: number;
  promoLabel?: string;
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

/**
 * Máximo de productos activos por plan. Fuente única: la usan los textos
 * públicos (acá) y el control del sistema (planLimits en lib/plan-access.ts);
 * la base lo repite en plan_limit (migración 0049).
 */
export const PRODUCT_LIMITS: Record<Plan, number> = {
  gratis: 1000,
  basico: 4000,
  pro: 12000,
  max: 20000,
};

/** "4.000" (a mano: igual en el servidor y en el navegador). */
export function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const products = (plan: Plan) => `${thousands(PRODUCT_LIMITS[plan])} productos`;

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
      `1 usuario, 1 caja y hasta ${products("gratis")}`,
    ],
  },
  basico: {
    plan: "basico",
    name: "Plan Básico",
    price: 17000,
    priceLabel: "$17.000",
    promoPrice: 15000,
    promoLabel: "$15.000",
    period: "por mes · IVA incl.",
    badge: null,
    features: [
      "Todas las funciones del Plan Gratis +",
      "Ventas ilimitadas",
      "Control de stock, alertas y reposición",
      "Avisos configurables, de margen bajo y de costos sin actualizar",
      "Cuentas corrientes de clientes y proveedores, con vencimientos y calendario de pagos",
      "Control de caja por empleado",
      "Carga masiva de productos y clientes con Excel",
      "Códigos de barras propios y etiquetas para imprimir",
      `Hasta ${products("basico")}, 2 usuarios y 2 cajas`,
    ],
    soon: [
      "Talles, combos y kits",
    ],
  },
  pro: {
    plan: "pro",
    name: "Plan Pro",
    price: 29000,
    priceLabel: "$29.000",
    promoPrice: 25000,
    promoLabel: "$25.000",
    period: "por mes · IVA incl.",
    badge: "Más elegido",
    features: [
      "Todas las funciones del Plan Básico +",
      "Aumentos masivos de precios en segundos",
      "Aviso cuando sube el costo y no actualizaste el precio",
      "Reportes avanzados",
      "Mirá el negocio en vivo, desde casa, en tu celular",
      `Hasta ${products("pro")}, 6 usuarios y 6 cajas`,
      "Soporte prioritario",
    ],
    soon: [
      "Control por usuario: su stock, caja y diferencias",
      "Controlá inventarios físicos",
      "Soporte para balanzas",
      "Carteles de precios para imprimir",
      "1 catálogo online",
      "Ofertas y promociones",
    ],
  },
  max: {
    plan: "max",
    name: "Plan Max",
    price: 34000,
    priceLabel: "$34.000",
    promoPrice: 28000,
    promoLabel: "$28.000",
    period: "por mes · IVA incl.",
    badge: "Con IA",
    features: [
      "Todas las funciones del Plan Pro +",
      `Hasta ${products("max")} y 2 sucursales, cada una con su stock`,
      "Soporte prioritario 24/7",
      "Sugerencia de precios cuando sube el costo",
      "Qué reponer y cuánto, con el pedido para WhatsApp",
      "Productos que no rotan y plata parada",
      "Resumen escrito de cada período en Reportes",
      "Novedades y precios de referencia de tu rubro",
      "Ganancias separadas por sucursal",
    ],
  },
};

// Planes pagos, en el mismo orden que se muestran en la página de precios
// y en Configuración. El Plan Gratis (planDefinitions.gratis) se maneja
// aparte porque no tiene CTA de "pasarse" — es el punto de partida.
export const paidPlanDefinitions: PlanDefinition[] = [
  planDefinitions.basico,
  planDefinitions.pro,
  planDefinitions.max,
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

const everyPlan: Record<Plan, ComparisonValue> = { gratis: true, basico: true, pro: true, max: true };
const fromBasico: Record<Plan, ComparisonValue> = { gratis: false, basico: true, pro: true, max: true };
const onlyMax: Record<Plan, ComparisonValue> = { gratis: false, basico: false, pro: false, max: true };
const fromPro: Record<Plan, ComparisonValue> = { gratis: false, basico: false, pro: true, max: true };

// Tabla de /comparar-planes, agrupada por tema. Tiene que decir lo mismo que
// las features de cada plan de arriba: si cambia una, cambiar la otra.
export const planComparison: { title: string; rows: ComparisonRow[] }[] = [
  {
    title: "Límites",
    rows: [
      {
        label: "Ventas por mes",
        values: { gratis: "150", basico: "Ilimitadas", pro: "Ilimitadas", max: "Ilimitadas" },
      },
      { label: "Usuarios", values: { gratis: "1", basico: "2", pro: "6", max: "6" } },
      {
        label: "Productos activos",
        values: {
          gratis: thousands(PRODUCT_LIMITS.gratis),
          basico: thousands(PRODUCT_LIMITS.basico),
          pro: thousands(PRODUCT_LIMITS.pro),
          max: thousands(PRODUCT_LIMITS.max),
        },
      },
      { label: "Cajas", values: { gratis: "1", basico: "2", pro: "6", max: "6" } },
      { label: "Sucursales", values: { gratis: "1", basico: "1", pro: "1", max: "2" } },
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
        label: "Generar e imprimir códigos de barras para productos que no tienen",
        values: fromBasico,
      },
      {
        label: "Balanzas conectadas",
        values: { gratis: false, basico: false, pro: "Pronto", max: "Pronto" },
      },
      {
        label: "Carteles de precios para imprimir, siempre actualizados",
        values: { gratis: false, basico: false, pro: "Pronto", max: "Pronto" },
      },
      {
        label: "Catálogo online",
        values: { gratis: false, basico: false, pro: "Pronto (1)", max: "Pronto (1)" },
      },
      {
        label: "Combos y kits",
        values: { gratis: false, basico: "Pronto", pro: "Pronto", max: "Pronto" },
      },
      {
        label: "Talles y colores (variantes)",
        values: { gratis: false, basico: "Pronto", pro: "Pronto", max: "Pronto" },
      },
      {
        label: "Ofertas y promociones",
        values: { gratis: false, basico: false, pro: "Pronto", max: "Pronto" },
      },
    ],
  },
  {
    title: "Stock, precios y compras",
    rows: [
      { label: "Stock que se actualiza con cada venta y compra", values: everyPlan },
      {
        label: "Carga masiva de productos desde Excel, con costos y precios",
        values: fromBasico,
      },
      {
        label: "Carga masiva de clientes desde Excel (y bajar tu lista de clientes con lo que te deben)",
        values: fromBasico,
      },
      { label: "Stock mínimo, aviso de faltantes y lista para reponer", values: fromBasico },
      { label: "Bajar tu lista de productos a una planilla de Excel (elegís qué productos y qué columnas)", values: everyPlan },
      { label: "Corregir costo y stock mínimo desde la lista y filtrar por estado del stock", values: everyPlan },
      { label: "Historial de movimientos de stock", values: fromBasico },
      {
        label: "Avisos en la campana y en cada módulo (stock bajo, venta a pérdida, números para revisar, fiado, proveedores y caja), con urgentes y \"visto\"",
        values: everyPlan,
      },
      { label: "Configurar los avisos, y avisos de margen bajo y de costos sin actualizar", values: fromBasico },
      { label: "Aviso cuando sube el costo y no actualizaste el precio", values: fromPro },
      { label: "Aviso de plata parada en productos que no se venden", values: onlyMax },
      {
        label: "Precios de supermercados (Carrefour, Jumbo, Disco y Vea) de tus productos con código de barras, actualizados una vez por mes",
        values: { gratis: false, basico: false, pro: "Pronto", max: "Pronto" },
      },
      {
        label: "Precio sugerido y avisos de si estás caro o barato frente a los supermercados",
        values: { gratis: false, basico: false, pro: false, max: "Pronto" },
      },
      {
        label: "Inventarios físicos: contás y el stock se ajusta solo",
        values: { gratis: false, basico: false, pro: "Pronto", max: "Pronto" },
      },
      { label: "Historial de ventas: ver, reimprimir el ticket, anular con motivo (la venta nunca se borra) y exportar a Excel (CSV)", values: everyPlan },
      { label: "Compras a proveedores", values: everyPlan },
      {
        label: "Factura electrónica con ARCA (con tu CUIT y tu certificado): Factura A, B o C con CAE, en ticket de 80 mm o A4",
        values: { gratis: false, basico: "Pronto", pro: "Pronto", max: "Pronto" },
      },
      { label: "Historial de precios de cada producto", values: everyPlan },
      { label: "Cuenta corriente con proveedores (vencimientos y calendario)", values: fromBasico },
      { label: "Aumentos masivos de precios y costos, con deshacer", values: fromPro },
      { label: "Volver a un precio o costo anterior desde el historial", values: fromPro },
      { label: "Pases de mercadería entre sucursales", values: onlyMax },
    ],
  },
  {
    title: "Caja, clientes y equipo",
    rows: [
      { label: "Caja diaria con cierre y arqueo", values: everyPlan },
      { label: "Clientes con fiado (cuenta corriente)", values: everyPlan },
      { label: "Reportes con fechas a medida", values: fromBasico },
      { label: "Comparar con el período anterior o el año pasado", values: fromPro },
      { label: "En vivo: ventas del momento por sucursal y vendedor", values: fromPro },
      { label: "Ventas y diferencias de caja por empleado", values: fromBasico },
      { label: "Avisos de faltantes y sobrantes al cerrar la caja, y de faltantes que se repiten", values: fromBasico },
      { label: "Historial completo de caja", values: fromPro },
      {
        label: "Control por usuario: todos sus movimientos de stock, caja y diferencias",
        values: { gratis: false, basico: false, pro: "Pronto", max: "Pronto" },
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
        values: onlyMax,
      },
    ],
  },
  {
    title: "Soporte e inteligencia artificial",
    rows: [
      { label: "Soporte prioritario", values: { gratis: false, basico: false, pro: true, max: "24/7" } },
      { label: "Sugerencia de precios", values: onlyMax },
      { label: "Recomendaciones de reposición", values: onlyMax },
      { label: "Detección de productos de baja rotación", values: onlyMax },
      { label: "Resumen escrito de cada período en Reportes", values: onlyMax },
      { label: "Novedades y precios de referencia de tu rubro", values: onlyMax },
    ],
  },
];
