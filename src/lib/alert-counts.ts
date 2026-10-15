import type { BusinessAlertCounts } from "@/app/(dashboard)/alertas/actions";
import type { BellAlert } from "@/lib/bell-alerts";
import { productAlerts } from "@/lib/product-alerts";
import { formatCurrency } from "@/lib/utils";
import type { Plan } from "@/lib/subscription";

/** Pasa los conteos que trae el servidor (stock, números para revisar y fiado) a avisos. */
export function countsToAlerts(counts: BusinessAlertCounts | null, stockLockedPlan: Plan | null): BellAlert[] {
  if (!counts) return [];
  const out: BellAlert[] = productAlerts(counts.products, stockLockedPlan);
  if (counts.debtorCount > 0) {
    const n = counts.debtorCount;
    out.push({
      id: "fiado",
      module: "clientes",
      tone: "info",
      title: `Te deben ${formatCurrency(counts.debtTotal)} en fiado`,
      detail: n === 1 ? "De 1 cliente." : `De ${n} clientes.`,
      href: "/clientes",
    });
  }
  return out;
}
