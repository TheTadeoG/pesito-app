"use client";

import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { AlertsPanel } from "@/components/dashboard/alerts-bell";
import { productAlerts, type ProductIssueCounts } from "@/lib/product-alerts";
import type { BellTone } from "@/lib/bell-alerts";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/subscription";

const chipTone: Record<BellTone, string> = {
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-accent text-accent-foreground",
};

/**
 * Los mismos avisos de la campana que tocan al catálogo, arriba de Productos y
 * Movimientos: una línea con el resumen y, al abrirla, cada aviso con su
 * atajo. No se muestra si no hay nada que avisar.
 */
export function CatalogAlerts({ counts, stockLockedPlan }: { counts: ProductIssueCounts; stockLockedPlan: Plan | null }) {
  const [open, setOpen] = useState(false);
  const alerts = productAlerts(counts, stockLockedPlan);
  if (alerts.length === 0) return null;
  const worst = alerts.some((a) => a.tone === "danger") ? "danger" : "warning";
  return (
    <section aria-label="Avisos del catálogo" className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", chipTone[worst])}>
          <Bell className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {alerts.length === 1 ? "1 aviso para atender" : `${alerts.length} avisos para atender`}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span key={a.id} className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", chipTone[a.tone])}>
                {a.chip ?? a.title}
              </span>
            ))}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border">
          <AlertsPanel alerts={alerts} />
        </div>
      )}
    </section>
  );
}
