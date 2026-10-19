import type { BusinessAlertCounts } from "@/app/(dashboard)/alertas/actions";
import type { BellAlert } from "@/lib/bell-alerts";
import { alertEnabled, type AlertSettings } from "@/lib/alert-config";
import { productAlerts, type AlertLocks } from "@/lib/product-alerts";
import { cashAlerts } from "@/lib/caja-alerts";
import { formatCurrency } from "@/lib/utils";

/** Pasa los conteos que trae el servidor (catálogo y fiado) a avisos, sin los que el negocio apagó. */
export function countsToAlerts(counts: BusinessAlertCounts | null, locks: AlertLocks, settings: AlertSettings): BellAlert[] {
  if (!counts) return [];
  const out: BellAlert[] = [...productAlerts(counts.products, locks, settings), ...cashAlerts(counts.cash, settings)];
  if (alertEnabled(settings, "fiado") && counts.debtorCount > 0) {
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
