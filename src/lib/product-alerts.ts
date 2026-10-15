import type { BellAlert } from "@/lib/bell-alerts";
import type { Plan } from "@/lib/subscription";

// Avisos sobre el catálogo (stock bajo y números para revisar). Una sola
// fuente: la campana de la barra de arriba y la tira de Productos, Stock y
// Marcas arman el mismo aviso con el mismo texto.

export interface ProductIssueCounts {
  /** Stock en el mínimo o por debajo. */
  low: number;
  negative: number;
  noCost: number;
  noMin: number;
  /** Costo por encima del precio de venta (se vende a pérdida). */
  loss: number;
}

/** Cuenta sobre los productos activos (con el stock de la sucursal actual). */
export function countProductIssues(
  products: { stock: number | string; min_stock: number | string; cost: number | string | null; price: number | string }[]
): ProductIssueCounts {
  const c: ProductIssueCounts = { low: 0, negative: 0, noCost: 0, noMin: 0, loss: 0 };
  for (const p of products) {
    const stock = Number(p.stock);
    const min = Number(p.min_stock);
    if (stock <= min) c.low += 1;
    if (stock < 0) c.negative += 1;
    if (p.cost === null || Number(p.cost) <= 0) c.noCost += 1;
    if (min <= 0) c.noMin += 1;
    if (p.cost !== null && Number(p.cost) > Number(p.price)) c.loss += 1;
  }
  return c;
}

/**
 * Stock bajo y "revisar números" (stock negativo, sin costo, sin mínimo).
 * Con el stock bloqueado por el plan, el aviso de stock bajo invita a
 * desbloquearlo y "sin mínimo" no se cuenta (el mínimo es de ese plan).
 */
export function productAlerts(counts: ProductIssueCounts, stockLockedPlan: Plan | null): BellAlert[] {
  const out: BellAlert[] = [];
  if (counts.low > 0) {
    const n = counts.low;
    out.push({
      id: "low-stock",
      module: "productos",
      tone: "warning",
      title: n === 1 ? "1 producto con stock bajo" : `${n} productos con stock bajo`,
      chip: `${n} con stock bajo`,
      detail: stockLockedPlan ? "Desbloqueá el detalle y la reposición con un plan más alto." : "Ya llegaron al mínimo que cargaste.",
      href: "/productos?estado=por-agotarse",
      // Reponer se hace en Qué comprar (si el plan no lo incluye, esa pantalla muestra con cuál se desbloquea).
      actions: stockLockedPlan ? undefined : [{ label: "Qué comprar", href: "/recomendaciones" }],
      lockedPlan: stockLockedPlan ?? undefined,
    });
  }
  if (counts.loss > 0) {
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
  const noMin = stockLockedPlan ? 0 : counts.noMin;
  const parts = [
    counts.negative > 0 ? `${counts.negative} con stock negativo` : null,
    counts.noCost > 0 ? `${counts.noCost} sin costo` : null,
    noMin > 0 ? `${noMin} sin mínimo` : null,
  ].filter((p): p is string => p !== null);
  if (parts.length > 0) {
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
