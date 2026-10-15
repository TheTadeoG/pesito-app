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
}

/** Cuenta sobre los productos activos (con el stock de la sucursal actual). */
export function countProductIssues(
  products: { stock: number | string; min_stock: number | string; cost: number | string | null }[]
): ProductIssueCounts {
  const c: ProductIssueCounts = { low: 0, negative: 0, noCost: 0, noMin: 0 };
  for (const p of products) {
    const stock = Number(p.stock);
    const min = Number(p.min_stock);
    if (stock <= min) c.low += 1;
    if (stock < 0) c.negative += 1;
    if (p.cost === null || Number(p.cost) <= 0) c.noCost += 1;
    if (min <= 0) c.noMin += 1;
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
      tone: "warning",
      title: n === 1 ? "1 producto con stock bajo" : `${n} productos con stock bajo`,
      detail: stockLockedPlan ? "Desbloqueá el detalle y la reposición con un plan más alto." : "Ya llegaron al mínimo que cargaste.",
      href: "/productos?estado=por-agotarse",
      lockedPlan: stockLockedPlan ?? undefined,
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
      tone: counts.negative > 0 ? "warning" : "info",
      title: "Hay números para revisar",
      detail: `${parts.join(", ")}. Corregirlos mejora tus reportes y avisos.`,
      href: counts.negative > 0 ? "/productos?estado=negativo" : counts.noCost > 0 ? "/productos?estado=sin-costo" : "/productos?estado=sin-minimo",
    });
  }
  return out;
}
