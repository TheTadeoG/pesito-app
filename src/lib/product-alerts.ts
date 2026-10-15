import type { BellAlert } from "@/lib/bell-alerts";
import { alertEnabled, alertValue, type AlertSettings } from "@/lib/alert-config";
import type { Plan } from "@/lib/subscription";
import { formatCurrency } from "@/lib/utils";

// Avisos sobre el catálogo (stock, precios y costos). Una sola fuente: la campana de la barra
// de arriba, la tira de Productos y el menú lateral arman el mismo aviso con el mismo texto.

/** Planes que desbloquean cada grupo de avisos (null si el negocio ya lo tiene). */
export interface AlertLocks {
  stock: Plan | null;
  margin: Plan | null;
  costRise: Plan | null;
  idle: Plan | null;
}

export interface ProductIssueCounts {
  /** Stock en el mínimo o por debajo. */
  low: number;
  negative: number;
  noCost: number;
  noMin: number;
  /** Costo por encima del precio de venta (se vende a pérdida). */
  loss: number;
  /** Gana menos del `thresholds.marginPercent`% sobre el costo (sin perder). */
  lowMargin: number;
  /** El costo no cambió en `thresholds.staleDays` días. */
  staleCost: number;
  /** El costo subió y el precio quedó igual (Plan Pro; 0 si no se calculó). */
  costRise: number;
  /** Productos con stock sin ventas en `thresholds.idleDays` días y la plata que hay ahí (Plan IA). */
  idleCount: number;
  idleCapital: number;
  thresholds: { marginPercent: number; staleDays: number; idleDays: number };
}

export const DEFAULT_THRESHOLDS: ProductIssueCounts["thresholds"] = { marginPercent: 10, staleDays: 90, idleDays: 30 };

export function thresholdsFrom(settings: AlertSettings): ProductIssueCounts["thresholds"] {
  return {
    marginPercent: alertValue(settings, "low-margin"),
    staleDays: alertValue(settings, "stale-cost"),
    idleDays: alertValue(settings, "idle-capital"),
  };
}

/** Cuenta sobre los productos activos (con el stock de la sucursal actual): lo que sale sólo de cada fila. */
export function countProductIssues(
  products: { stock: number | string; min_stock: number | string; cost: number | string | null; price: number | string }[],
  thresholds: ProductIssueCounts["thresholds"] = DEFAULT_THRESHOLDS
): ProductIssueCounts {
  const c: ProductIssueCounts = {
    low: 0,
    negative: 0,
    noCost: 0,
    noMin: 0,
    loss: 0,
    lowMargin: 0,
    staleCost: 0,
    costRise: 0,
    idleCount: 0,
    idleCapital: 0,
    thresholds,
  };
  for (const p of products) {
    const stock = Number(p.stock);
    const min = Number(p.min_stock);
    const cost = p.cost === null ? null : Number(p.cost);
    const price = Number(p.price);
    if (stock <= min) c.low += 1;
    if (stock < 0) c.negative += 1;
    if (cost === null || cost <= 0) c.noCost += 1;
    if (min <= 0) c.noMin += 1;
    if (cost !== null && cost > price) c.loss += 1;
    if (cost !== null && cost > 0 && price >= cost && (price / cost - 1) * 100 < thresholds.marginPercent) c.lowMargin += 1;
  }
  return c;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/**
 * Avisos del catálogo, ya sin los que el negocio apagó. Con un grupo bloqueado por el plan, el
 * aviso se muestra (si hay datos) invitando a desbloquearlo; "sin mínimo" no cuenta sin
 * gestión de stock (el mínimo es de ese plan).
 */
export function productAlerts(counts: ProductIssueCounts, locks: AlertLocks, settings: AlertSettings = {}): BellAlert[] {
  const out: BellAlert[] = [];
  const t = counts.thresholds;
  const on = (id: string) => alertEnabled(settings, id);

  if (on("low-stock") && counts.low > 0) {
    const n = counts.low;
    out.push({
      id: "low-stock",
      module: "productos",
      tone: "warning",
      title: plural(n, "producto con stock bajo", "productos con stock bajo"),
      chip: `${n} con stock bajo`,
      detail: locks.stock ? "Desbloqueá el detalle y la reposición con un plan más alto." : "Ya llegaron al mínimo que cargaste.",
      href: "/productos?estado=por-agotarse",
      // Reponer se hace en Qué comprar (si el plan no lo incluye, esa pantalla muestra con cuál se desbloquea).
      actions: locks.stock ? undefined : [{ label: "Qué comprar", href: "/recomendaciones" }],
      lockedPlan: locks.stock ?? undefined,
    });
  }
  if (on("selling-at-loss") && counts.loss > 0) {
    const n = counts.loss;
    out.push({
      id: "selling-at-loss",
      module: "productos",
      tone: "danger",
      title: n === 1 ? "1 producto se vende a pérdida" : `${n} productos se venden a pérdida`,
      chip: `${n} a pérdida`,
      detail: "El costo supera el precio de venta: cada venta te hace perder plata. Revisá los precios.",
      href: "/productos?alertas=1",
    });
  }
  if (on("cost-rise") && counts.costRise > 0) {
    const n = counts.costRise;
    out.push({
      id: "cost-rise",
      module: "productos",
      tone: "warning",
      title: n === 1 ? "1 producto subió de costo y sigue al mismo precio" : `${n} productos subieron de costo y siguen al mismo precio`,
      chip: `${n} precio sin actualizar`,
      detail: "Si no subís el precio, cada venta te deja menos ganancia.",
      href: "/productos?estado=precio-viejo",
    });
  }
  if (on("low-margin") && counts.lowMargin > 0) {
    const n = counts.lowMargin;
    out.push({
      id: "low-margin",
      module: "productos",
      tone: "info",
      title: plural(n, "producto con margen bajo", "productos con margen bajo"),
      chip: `${n} margen bajo`,
      detail: locks.margin ? "Desbloqueá el detalle con un plan más alto." : `Ganás menos del ${t.marginPercent}% sobre el costo.`,
      href: "/productos?estado=margen-bajo",
      lockedPlan: locks.margin ?? undefined,
    });
  }
  if (on("stale-cost") && counts.staleCost > 0) {
    const n = counts.staleCost;
    out.push({
      id: "stale-cost",
      module: "productos",
      tone: "info",
      title: n === 1 ? "1 producto con el costo sin actualizar" : `${n} productos con el costo sin actualizar`,
      chip: `${n} costo viejo`,
      detail: locks.margin
        ? "Desbloqueá el detalle con un plan más alto."
        : `Hace más de ${t.staleDays} días que no cambia. Con inflación, probablemente esté viejo.`,
      href: "/productos?estado=costo-viejo",
      lockedPlan: locks.margin ?? undefined,
    });
  }
  if (on("idle-capital") && counts.idleCount > 0) {
    out.push({
      id: "idle-capital",
      module: "productos",
      tone: "info",
      title: `Tenés ${formatCurrency(counts.idleCapital)} parados en ${plural(counts.idleCount, "producto", "productos")}`,
      chip: `${formatCurrency(counts.idleCapital)} parados`,
      detail: `Tienen stock y no se vendieron hace ${t.idleDays} días.`,
      href: "/productos?estado=sin-ventas",
    });
  }

  const noMin = locks.stock ? 0 : counts.noMin;
  const parts = [
    counts.negative > 0 ? `${counts.negative} con stock negativo` : null,
    counts.noCost > 0 ? `${counts.noCost} sin costo` : null,
    noMin > 0 ? `${noMin} sin mínimo` : null,
  ].filter((p): p is string => p !== null);
  if (on("review-numbers") && parts.length > 0) {
    out.push({
      id: "review-numbers",
      module: "productos",
      tone: counts.negative > 0 ? "warning" : "info",
      title: "Hay números para revisar",
      chip: `${counts.negative + counts.noCost + noMin} para revisar`,
      detail: `${parts.join(", ")}. Corregirlos mejora tus reportes y avisos.`,
      href: counts.negative > 0 ? "/productos?estado=negativo" : counts.noCost > 0 ? "/productos?estado=sin-costo" : "/productos?estado=sin-minimo",
      actions: [
        counts.negative > 0 ? { label: "Stock negativo", href: "/productos?estado=negativo" } : null,
        counts.noCost > 0 ? { label: "Sin costo", href: "/productos?estado=sin-costo" } : null,
        noMin > 0 ? { label: "Sin mínimo", href: "/productos?estado=sin-minimo" } : null,
      ].filter((a): a is { label: string; href: string } => a !== null),
    });
  }
  return out;
}
