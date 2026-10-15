"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  HandCoins,
  Info,
  PackageX,
  RotateCcw,
  Settings2,
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
import { useAlerts } from "@/components/dashboard/alerts-provider";
import { alertPriority, type BellAlert, type BellTone } from "@/lib/bell-alerts";
import { cn } from "@/lib/utils";

const toneIcon: Record<BellTone, LucideIcon> = { danger: AlertTriangle, warning: AlertTriangle, info: Info };
const toneClass: Record<BellTone, string> = {
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-accent text-accent-foreground",
};

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

function AlertCard({ alert: a, seen, onNavigate }: { alert: BellAlert; seen: boolean; onNavigate?: (a: BellAlert) => void }) {
  const { markSeen, unmarkSeen } = useAlerts();
  const Icon = kindIcon[a.id] ?? toneIcon[a.tone];
  const href = a.lockedPlan ? upgradeHref(a.lockedPlan) : a.href;
  const canMark = !a.pinned && !a.lockedPlan;
  return (
    <li
      className={cn(
        "overflow-hidden rounded-xl border border-l-[3px] border-border bg-background/60",
        toneAccent[a.tone],
        seen && "opacity-60"
      )}
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
      {((a.actions && a.actions.length > 0 && !a.lockedPlan) || canMark) && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 pl-[3.75rem]">
          {!a.lockedPlan &&
            a.actions?.map((act) => (
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
          {canMark && (
            <button
              type="button"
              onClick={() => (seen ? unmarkSeen(a) : markSeen(a))}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={seen ? "Volver a avisarme" : "Ya lo vi: no lo cuentes hasta que cambie"}
            >
              {seen ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              {seen ? "Volver a avisar" : "Visto"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function GroupTitle({ children, count, tone }: { children: string; count: number; tone?: BellTone }) {
  return (
    <p className="flex items-center gap-1.5 px-1 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {tone && <span className={cn("h-1.5 w-1.5 rounded-full", tone === "danger" ? "bg-danger" : "bg-warning")} />}
      {children}
      <span className="font-medium normal-case tracking-normal">{`· ${count}`}</span>
    </p>
  );
}

/**
 * Lista de avisos por urgencia: Urgentes, No urgentes y Vistos (plegados). La usan la campana
 * y la tira de cada módulo con los avisos que les tocan.
 */
export function AlertList({
  alerts,
  onNavigate,
  className,
}: {
  alerts: BellAlert[];
  onNavigate?: (alert: BellAlert) => void;
  className?: string;
}) {
  const { markAllSeen, seen: seenAll } = useAlerts();
  const [showSeen, setShowSeen] = useState(false);
  const seenIds = new Set(seenAll.map((a) => a.id));
  const unseen = alerts.filter((a) => !seenIds.has(a.id));
  const seen = alerts.filter((a) => seenIds.has(a.id));
  const urgent = unseen.filter((a) => alertPriority(a) === "urgent");
  const normal = unseen.filter((a) => alertPriority(a) !== "urgent");

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
    <div className={cn("max-h-[min(26rem,70vh)] overflow-y-auto p-2", className)}>
      {unseen.length === 0 && (
        <p className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
          <CheckCheck className="h-4 w-4 text-success" />
          Viste todos los avisos.
        </p>
      )}
      {urgent.length > 0 && (
        <section>
          <GroupTitle count={urgent.length} tone="danger">
            Urgentes
          </GroupTitle>
          <ul className="space-y-2">
            {urgent.map((a) => (
              <AlertCard key={a.id} alert={a} seen={false} onNavigate={onNavigate} />
            ))}
          </ul>
        </section>
      )}
      {normal.length > 0 && (
        <section className={urgent.length > 0 ? "mt-3" : undefined}>
          <GroupTitle count={normal.length} tone="warning">
            No urgentes
          </GroupTitle>
          <ul className="space-y-2">
            {normal.map((a) => (
              <AlertCard key={a.id} alert={a} seen={false} onNavigate={onNavigate} />
            ))}
          </ul>
        </section>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        {seen.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowSeen((v) => !v)}
            aria-expanded={showSeen}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSeen && "rotate-180")} />
            {`Vistos (${seen.length})`}
          </button>
        ) : (
          <span />
        )}
        {unseen.filter((a) => !a.pinned && !a.lockedPlan).length > 1 && (
          <button
            type="button"
            onClick={markAllSeen}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todo como visto
          </button>
        )}
      </div>
      {showSeen && seen.length > 0 && (
        <ul className="mt-2 space-y-2">
          {seen.map((a) => (
            <AlertCard key={a.id} alert={a} seen onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Campana de la barra de arriba: todos los avisos del negocio por urgencia. El número es la
 * cantidad de AVISOS sin ver (la suma de las insignias del menú lateral); es rojo si alguno es
 * urgente. Lo que está fuera del plan se ve igual en la lista, con el plan que lo desbloquea.
 */
export function AlertsBell() {
  const { alerts, total, urgentTotal, refresh } = useAlerts();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

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

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={total > 0 ? `Avisos (${total})` : "Avisos"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn("relative", open && "border-primary")}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span
            className={cn(
              "absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
              urgentTotal > 0 ? "bg-danger" : "bg-warning"
            )}
          >
            {total}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3.5">
            <p className="text-sm font-semibold text-foreground">Avisos</p>
            <div className="flex items-center gap-2">
              {total > 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    urgentTotal > 0 ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning"
                  )}
                >
                  {urgentTotal > 0 ? `${urgentTotal} urgente${urgentTotal === 1 ? "" : "s"} · ${total} en total` : `${total} sin ver`}
                </span>
              )}
              <Link
                href="/configuracion#avisos"
                prefetch={false}
                onClick={() => setOpen(false)}
                aria-label="Configurar avisos"
                title="Configurar avisos"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <AlertList alerts={alerts} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
