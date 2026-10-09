"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanPill, upgradeHref } from "@/components/dashboard/pro-locked-card";
import { getBusinessAlerts, type BusinessAlertCounts } from "@/app/(dashboard)/alertas/actions";
import { cashAlert, type BellAlert, type BellTone } from "@/lib/bell-alerts";
import { cn, formatCurrency } from "@/lib/utils";
import type { Plan } from "@/lib/subscription";

const STALE_MS = 5 * 60 * 1000;

const toneIcon: Record<BellTone, LucideIcon> = { danger: AlertTriangle, warning: AlertTriangle, info: Info };
const toneClass: Record<BellTone, string> = {
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-accent text-accent-foreground",
};

/** Pasa los conteos de stock y fiado a avisos (con el plan que desbloquea el stock, si no lo tiene). */
export function countsToAlerts(counts: BusinessAlertCounts | null, stockLockedPlan: Plan | null): BellAlert[] {
  if (!counts) return [];
  const out: BellAlert[] = [];
  if (counts.lowStock > 0) {
    const n = counts.lowStock;
    out.push({
      id: "low-stock",
      tone: "warning",
      title: n === 1 ? "1 producto con stock bajo" : `${n} productos con stock bajo`,
      detail: stockLockedPlan ? "Desbloqueá el detalle y la reposición con un plan más alto." : "Ya llegaron al mínimo que cargaste.",
      href: "/productos?tab=stock",
      lockedPlan: stockLockedPlan ?? undefined,
    });
  }
  if (counts.debtorCount > 0) {
    const n = counts.debtorCount;
    out.push({
      id: "fiado",
      tone: "info",
      title: `Te deben ${formatCurrency(counts.debtTotal)} en fiado`,
      detail: n === 1 ? "De 1 cliente." : `De ${n} clientes.`,
      href: "/clientes",
    });
  }
  return out;
}

/** Lista de avisos (sin la lógica de carga): el contenido del menú de la campana. */
export function AlertsPanel({ alerts, onNavigate }: { alerts: BellAlert[]; onNavigate?: (alert: BellAlert) => void }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-5 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-success" />
        Todo en orden por ahora.
      </div>
    );
  }
  return (
    <ul className="max-h-[min(24rem,70vh)] divide-y divide-border overflow-y-auto">
      {alerts.map((a) => {
        const Icon = toneIcon[a.tone];
        const href = a.lockedPlan ? upgradeHref(a.lockedPlan) : a.href;
        return (
          <li key={a.id}>
            <Link
              href={href}
              prefetch={false}
              onClick={() => onNavigate?.(a)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", toneClass[a.tone])}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                  {a.title}
                  {a.lockedPlan && <PlanPill plan={a.lockedPlan} />}
                </span>
                {a.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{a.detail}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Campana de la barra de arriba: avisos del negocio (plan, caja, dispositivos nuevos,
 * deuda con proveedores, stock bajo y fiado). El número rojo cuenta sólo lo que se
 * puede atender hoy; lo que está fuera del plan se ve igual en la lista, con el plan
 * que lo desbloquea.
 */
export function AlertsBell({
  serverAlerts,
  cash,
  stockLockedPlan,
}: {
  serverAlerts: BellAlert[];
  cash: { openedAt: string; closeTime: string | null } | null;
  stockLockedPlan: Plan | null;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<BusinessAlertCounts | null>(null);
  const loadedAt = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    loadedAt.current = Date.now();
    const next = await getBusinessAlerts();
    if (next) setCounts(next);
  }, []);

  // Una vez al entrar (sin apurar la carga de la pantalla) y al abrir si pasaron unos minutos.
  useEffect(() => {
    const id = window.setTimeout(load, 1500);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (open && Date.now() - loadedAt.current > STALE_MS) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Avisos que se descartan al abrirlos (ver BellAlert.dismiss): se leen del navegador.
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  useEffect(() => {
    const found: Record<string, string> = {};
    for (const a of serverAlerts) {
      if (!a.dismiss) continue;
      try {
        const stored = window.localStorage.getItem(a.dismiss.key);
        if (stored) found[a.id] = stored;
      } catch {
        // sin almacenamiento: el aviso se ve siempre
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(found);
  }, [serverAlerts]);

  const dismissAlert = useCallback((a: BellAlert) => {
    if (!a.dismiss) return;
    const { key, token } = a.dismiss;
    try {
      window.localStorage.setItem(key, token);
    } catch {
      // ignore
    }
    setDismissed((d) => ({ ...d, [a.id]: token }));
  }, []);

  const alerts = useMemo(() => {
    const visibleServer = serverAlerts.filter((a) => !a.dismiss || dismissed[a.id] !== a.dismiss.token);
    const cashItem = cash ? cashAlert(cash.openedAt, cash.closeTime) : null;
    const order: Record<BellTone, number> = { danger: 0, warning: 1, info: 2 };
    return [...visibleServer, ...(cashItem ? [cashItem] : []), ...countsToAlerts(counts, stockLockedPlan)].sort(
      (a, b) => order[a.tone] - order[b.tone]
    );
    // El aviso de la caja depende de la hora: se recalcula cada vez que se abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverAlerts, dismissed, cash, counts, stockLockedPlan, open]);

  const actionable = alerts.filter((a) => !a.lockedPlan).length;
  const urgent = alerts.some((a) => a.tone === "danger" && !a.lockedPlan);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={actionable > 0 ? `Avisos (${actionable})` : "Avisos"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn("relative", open && "border-primary")}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {actionable > 0 && (
          <span
            className={cn(
              "absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
              urgent ? "bg-danger" : "bg-warning"
            )}
          >
            {actionable > 9 ? "9+" : actionable}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          <p className="px-4 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Avisos
          </p>
          <AlertsPanel
            alerts={alerts}
            onNavigate={(a) => {
              dismissAlert(a);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
