"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  HandCoins,
  Info,
  PackageX,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Truck,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanPill, upgradeHref } from "@/components/dashboard/pro-locked-card";
import { getBusinessAlerts, type BusinessAlertCounts } from "@/app/(dashboard)/alertas/actions";
import { cashAlert, type BellAlert, type BellTone } from "@/lib/bell-alerts";
import { productAlerts } from "@/lib/product-alerts";
import { cn, formatCurrency } from "@/lib/utils";
import type { Plan } from "@/lib/subscription";

const STALE_MS = 5 * 60 * 1000;

const toneIcon: Record<BellTone, LucideIcon> = { danger: AlertTriangle, warning: AlertTriangle, info: Info };
const toneClass: Record<BellTone, string> = {
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-accent text-accent-foreground",
};

/** Pasa los conteos (stock, números para revisar y fiado) a avisos. */
export function countsToAlerts(counts: BusinessAlertCounts | null, stockLockedPlan: Plan | null): BellAlert[] {
  if (!counts) return [];
  const out: BellAlert[] = productAlerts(counts.products, stockLockedPlan);
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

// Un ícono propio por tipo de aviso (se reconoce de un vistazo); sin uno, el de su urgencia.
const kindIcon: Record<string, LucideIcon> = {
  "low-stock": PackageX,
  "review-numbers": Wrench,
  "selling-at-loss": TrendingDown,
  fiado: HandCoins,
  "suppliers-overdue": Truck,
  "new-device": ShieldAlert,
  "trial-ending": Sparkles,
  "plan-past-due": CreditCard,
  "plan-grace": CreditCard,
  "plan-expiring": CreditCard,
  "cash-stale": Wallet,
  "cash-closing": Wallet,
  "cash-soon": Wallet,
};
const toneAccent: Record<BellTone, string> = {
  danger: "border-l-danger",
  warning: "border-l-warning",
  info: "border-l-primary",
};

/** Lista de avisos (sin la lógica de carga): el contenido de la campana y de la tira de Productos. */
export function AlertsPanel({ alerts, onNavigate }: { alerts: BellAlert[]; onNavigate?: (alert: BellAlert) => void }) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </span>
        <p className="text-sm font-semibold text-foreground">Todo en orden</p>
        <p className="max-w-[16rem] text-xs text-muted-foreground">Cuando haya algo para atender, te lo avisamos acá.</p>
      </div>
    );
  }
  return (
    <ul className="max-h-[min(26rem,70vh)] space-y-2 overflow-y-auto p-2">
      {alerts.map((a) => {
        const Icon = kindIcon[a.id] ?? toneIcon[a.tone];
        const href = a.lockedPlan ? upgradeHref(a.lockedPlan) : a.href;
        return (
          <li
            key={a.id}
            className={cn("overflow-hidden rounded-xl border border-l-[3px] border-border bg-background/60", toneAccent[a.tone])}
          >
            <Link
              href={href}
              prefetch={false}
              onClick={() => onNavigate?.(a)}
              className="group flex items-start gap-3 px-3 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", toneClass[a.tone])}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
                  {a.title}
                  {a.lockedPlan && <PlanPill plan={a.lockedPlan} />}
                </span>
                {a.detail && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{a.detail}</span>}
              </span>
              <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
            {a.actions && a.actions.length > 0 && !a.lockedPlan && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-3 pl-[3.75rem]">
                {a.actions.map((act) => (
                  <Link
                    key={act.href + act.label}
                    href={act.href}
                    prefetch={false}
                    onClick={() => onNavigate?.(a)}
                    className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {act.label}
                  </Link>
                ))}
              </div>
            )}
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
          <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3.5">
            <p className="text-sm font-semibold text-foreground">Avisos</p>
            {actionable > 0 && (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", urgent ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning")}>
                {actionable === 1 ? "1 para atender" : `${actionable} para atender`}
              </span>
            )}
          </div>
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
