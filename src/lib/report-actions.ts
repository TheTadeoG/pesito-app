// "Qué hacer": del resumen del período salen pocas acciones concretas, en dos grupos, como
// haría un encargado: qué SUMAR (reponer, cobrar, empujar lo que deja plata) y qué REVISAR O
// SACAR (vender a pérdida, margen flaco, stock parado). Son reglas fijas sobre números que
// Pesito ya calculó: no llama a ningún modelo ni manda datos a terceros. Cada acción dice qué
// pasa, cuánto es y a dónde ir. Sin datos que sustenten algo, no se inventa nada.

export interface ReportActionsInput {
  /** Stock en el mínimo o por debajo, y negativo (de los avisos del negocio). */
  lowStock: number;
  negativeStock: number;
  /** Clientes con fiado y cuánto deben. */
  debtorCount: number;
  debtTotal: number;
  /** Productos con costo por encima del precio y con margen flaco (de los avisos). */
  lossProducts: number;
  lowMargin: number;
  marginPercent: number;
  /** Stock parado: productos y plata inmovilizada (Plan Max; 0 si el plan no lo calcula). */
  idleCount: number;
  idleCapital: number;
  idleDays: number;
  /** Ventas del período, para no opinar sin datos. */
  salesCount: number;
  ingresos: number;
  /** Ganancia estimada del período (sólo con el plan que la calcula, si no null). */
  ganancia: number | null;
  /** Variación de ingresos contra el período anterior (null: sin comparar). */
  deltaPct: number | null;
  /** Producto que más ganancia dejó y el que más se vendió (si los hay). */
  topMargin: { name: string; margin: number } | null;
  topQuantity: { name: string } | null;
  /** Ventas a pérdida del período (Plan Pro). */
  soldAtLoss: { count: number; loss: number } | null;
  /** Parte de lo vendido que quedó en fiado (0 a 1). */
  fiadoShare: number;
  /** Diferencias de caja del período por faltante (cantidad de cierres y monto). */
  cashShortages: { count: number; total: number } | null;
}

export type ActionGroup = "sumar" | "revisar";
export type ActionTone = "danger" | "warning" | "info" | "success";

export interface ReportAction {
  id: string;
  group: ActionGroup;
  tone: ActionTone;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Math.round(n));

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-AR")} ${n === 1 ? one : many}`;

const TONE_ORDER: Record<ActionTone, number> = { danger: 0, warning: 1, info: 2, success: 3 };

/** Hasta `max` acciones por grupo, las más urgentes primero. */
export function buildReportActions(i: ReportActionsInput, max = 3): ReportAction[] {
  const out: ReportAction[] = [];

  // ── Sumar ──
  if (i.lowStock + i.negativeStock > 0) {
    out.push({
      id: "reponer",
      group: "sumar",
      tone: i.negativeStock > 0 ? "danger" : "warning",
      title: `Reponé ${plural(i.lowStock + i.negativeStock, "producto", "productos")} con poco stock`,
      detail:
        i.negativeStock > 0
          ? `${plural(i.negativeStock, "tiene", "tienen")} stock negativo: revisá el inventario. Sin stock no hay venta.`
          : "Están en el mínimo o por debajo. Reponelos antes de que se corten.",
      href: "/recomendaciones",
      cta: "Ver qué comprar",
    });
  }
  if (i.debtTotal > 0) {
    out.push({
      id: "cobrar",
      group: "sumar",
      tone: i.fiadoShare > 0.2 ? "warning" : "info",
      title: `Cobrá ${money(i.debtTotal)} de fiado`,
      detail: `${plural(i.debtorCount, "cliente te debe", "clientes te deben")} plata que ya vendiste.${
        i.fiadoShare > 0.2 ? ` Además, el ${Math.round(i.fiadoShare * 100)}% de lo vendido en el período quedó a cuenta: ponele un tope a cada cliente.` : ""
      }`,
      href: "/clientes",
      cta: "Ver quién debe",
    });
  }
  if (i.topMargin && i.topMargin.name !== i.topQuantity?.name && i.salesCount >= 10) {
    out.push({
      id: "empujar",
      group: "sumar",
      tone: "success",
      title: `Empujá ${i.topMargin.name}`,
      detail: `Es lo que más plata te dejó (${money(i.topMargin.margin)} de ganancia estimada) y no es lo que más se vende: ponelo a la vista y ofrecelo.`,
      href: "/productos",
      cta: "Ver productos",
    });
  }
  if (i.deltaPct !== null && i.deltaPct <= -10 && i.salesCount > 0) {
    out.push({
      id: "caida",
      group: "sumar",
      tone: "warning",
      title: `Las ventas bajaron ${Math.abs(Math.round(i.deltaPct))}%`,
      detail: "Contra el período anterior. Mirá qué días y horas flojearon y si te quedaste sin algún producto clave.",
      href: "/reportes",
      cta: "Ver el detalle",
    });
  }

  // ── Revisar o sacar ──
  const lossCount = Math.max(i.lossProducts, i.soldAtLoss?.count ?? 0);
  if (lossCount > 0) {
    out.push({
      id: "perdida",
      group: "revisar",
      tone: "danger",
      title: `Subí el precio de ${plural(lossCount, "producto", "productos")} que vendés a pérdida`,
      detail: i.soldAtLoss && i.soldAtLoss.loss > 0
        ? `En el período perdiste unos ${money(i.soldAtLoss.loss)}: el costo está por encima del precio.`
        : "El costo está por encima del precio de venta: cada unidad que vendés te saca plata.",
      href: "/productos",
      cta: "Corregir precios",
    });
  }
  if (i.lowMargin > 0) {
    out.push({
      id: "margen",
      group: "revisar",
      tone: "warning",
      title: `Revisá el margen de ${plural(i.lowMargin, "producto", "productos")}`,
      detail: `Ganás menos de ${i.marginPercent}% sobre el costo: casi todo se va en reponer. Subí el precio o cambiá de proveedor.`,
      href: "/productos",
      cta: "Ver productos",
    });
  }
  if (i.idleCount > 0) {
    out.push({
      id: "parado",
      group: "revisar",
      tone: "warning",
      title: `Liquidá o sacá ${plural(i.idleCount, "producto parado", "productos parados")}`,
      detail: `Hay ${money(i.idleCapital)} en mercadería que no se vendió en ${i.idleDays} días. Hacé una promo, armá un combo o no lo repongas.`,
      href: "/baja-rotacion",
      cta: "Ver stock parado",
    });
  }
  if (i.cashShortages && i.cashShortages.count > 0) {
    out.push({
      id: "caja",
      group: "revisar",
      tone: "danger",
      title: `Revisá ${plural(i.cashShortages.count, "cierre de caja con faltante", "cierres de caja con faltante")}`,
      detail: `Faltaron ${money(i.cashShortages.total)} en total en el período. Mirá quién cerró y en qué turno.`,
      href: "/caja",
      cta: "Ver cierres",
    });
  }
  if (i.ganancia !== null && i.ingresos > 0 && i.ganancia / i.ingresos < 0.1 && lossCount === 0) {
    out.push({
      id: "ganancia-baja",
      group: "revisar",
      tone: "warning",
      title: "Te queda menos del 10% de lo que vendés",
      detail: `De ${money(i.ingresos)} vendidos, la ganancia estimada es ${money(i.ganancia)}. Revisá precios y costos de lo que más vendés.`,
      href: "/productos",
      cta: "Revisar precios",
    });
  }

  const byGroup = (g: ActionGroup) =>
    out
      .filter((a) => a.group === g)
      .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
      .slice(0, max);
  return [...byGroup("sumar"), ...byGroup("revisar")];
}
