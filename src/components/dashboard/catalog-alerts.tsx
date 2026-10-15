import { AlertsPanel } from "@/components/dashboard/alerts-bell";
import { productAlerts, type ProductIssueCounts } from "@/lib/product-alerts";
import type { Plan } from "@/lib/subscription";

/**
 * Los mismos avisos de la campana que tocan al catálogo (stock bajo y números
 * para revisar), arriba de Productos, Stock y Marcas. No se muestra si no hay
 * nada que avisar.
 */
export function CatalogAlerts({ counts, stockLockedPlan }: { counts: ProductIssueCounts; stockLockedPlan: Plan | null }) {
  const alerts = productAlerts(counts, stockLockedPlan);
  if (alerts.length === 0) return null;
  return (
    <section aria-label="Avisos del catálogo" className="overflow-hidden rounded-2xl border border-border bg-card">
      <AlertsPanel alerts={alerts} />
    </section>
  );
}
