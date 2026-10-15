"use client";

import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { AlertList } from "@/components/dashboard/alerts-bell";
import { useAlerts } from "@/components/dashboard/alerts-provider";
import { alertPriority, MODULE_LABEL, type AlertModule, type BellTone } from "@/lib/bell-alerts";
import { cn } from "@/lib/utils";

const chipTone: Record<BellTone, string> = {
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-accent text-accent-foreground",
};

/**
 * Los avisos de un módulo (la misma lista y los mismos números que la campana y la
 * insignia del menú lateral): una línea con el resumen y, al abrirla, cada aviso con su
 * atajo, por urgencia. No se muestra si no hay nada sin ver.
 */
export function ModuleAlerts({ module = "productos" }: { module?: AlertModule }) {
  const { alerts, unseen } = useAlerts();
  const [open, setOpen] = useState(false);
  const mine = alerts.filter((a) => a.module === module);
  const pending = unseen.filter((a) => a.module === module && !a.lockedPlan);
  if (pending.length === 0) return null;
  const urgent = pending.filter((a) => alertPriority(a) === "urgent").length;
  return (
    <section aria-label={`Avisos de ${MODULE_LABEL[module]}`} className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", urgent > 0 ? chipTone.danger : chipTone.warning)}>
          <Bell className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {`${pending.length === 1 ? "1 aviso" : `${pending.length} avisos`}${urgent > 0 ? ` · ${urgent} urgente${urgent === 1 ? "" : "s"}` : ""}`}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {pending.map((a) => (
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
          <AlertList alerts={mine} />
        </div>
      )}
    </section>
  );
}
