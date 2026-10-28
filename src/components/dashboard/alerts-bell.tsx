"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanPill, upgradeHref } from "@/components/dashboard/pro-locked-card";
import { useAlerts } from "@/components/dashboard/alerts-provider";
import { alertPriority, MODULE_LABEL, type AlertModule, type BellAlert } from "@/lib/bell-alerts";
import { cn } from "@/lib/utils";

const dotClass: Record<"urgent" | "normal" | "info", string> = { urgent: "bg-danger", normal: "bg-warning", info: "bg-muted-foreground/50" };
const MODULE_ORDER: AlertModule[] = ["productos", "proveedores", "clientes", "caja", "plan", "seguridad"];

/** Un aviso, en una línea: puntito de urgencia, texto, atajo y "visto". El detalle queda en el tooltip. */
function AlertRow({ alert: a, seen, onNavigate }: { alert: BellAlert; seen: boolean; onNavigate?: (a: BellAlert) => void }) {
  const { markSeen, unmarkSeen } = useAlerts();
  const pathname = usePathname();
  const router = useRouter();

  // Si el aviso lleva a la pantalla donde ya estás (con un filtro o con el detalle abierto), un link
  // común no hace nada cuando la dirección es la misma, y la pantalla ya no vuelve a abrirlo. Se
  // navega con una marca nueva (`v`) para que la pantalla arranque de cero con ese aviso.
  function go(e: React.MouseEvent, target: string) {
    onNavigate?.(a);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(target, window.location.origin);
    if (url.pathname !== pathname || !url.search) return;
    e.preventDefault();
    url.searchParams.set("v", String(Date.now()));
    router.push(`${url.pathname}${url.search}`);
  }

  const href = a.lockedPlan ? upgradeHref(a.lockedPlan) : a.href;
  const canMark = !a.pinned && !a.lockedPlan;
  const priority = alertPriority(a) === "urgent" ? "urgent" : a.tone === "info" ? "info" : "normal";
  const action = !a.lockedPlan ? a.actions?.[0] : undefined;
  return (
    <li className={cn("group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted", seen && "opacity-60")}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass[priority])} aria-hidden />
      <Link
        href={href}
        prefetch={false}
        onClick={(e) => go(e, href)}
        title={a.detail}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm font-medium leading-snug text-foreground focus-visible:outline-none"
      >
        {a.title}
        {a.lockedPlan && <PlanPill plan={a.lockedPlan} />}
      </Link>
      {action && (
        <Link
          href={action.href}
          prefetch={false}
          onClick={(e) => go(e, action.href)}
          className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
        >
          {action.label}
        </Link>
      )}
      {canMark && (
        <button
          type="button"
          onClick={() => (seen ? unmarkSeen(a) : markSeen(a))}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          title={seen ? "Volver a avisarme" : "Ya lo vi: no lo cuentes hasta que cambie"}
          aria-label={seen ? "Volver a avisar" : "Marcar como visto"}
        >
          {seen ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        </button>
      )}
      <Link href={href} prefetch={false} onClick={(e) => go(e, href)} aria-label="Abrir" tabIndex={-1} className="shrink-0 text-muted-foreground">
        <ChevronRight className="h-4 w-4" />
      </Link>
    </li>
  );
}

/**
 * Lista de avisos por módulo: filtros arriba (Todos, Productos, Proveedores…), cada aviso en una
 * línea, y los ya vistos plegados al final. La usan la campana y la tira de cada módulo.
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
  const [filter, setFilter] = useState<AlertModule | "todos">("todos");
  const seenIds = new Set(seenAll.map((a) => a.id));
  const unseen = alerts.filter((a) => !seenIds.has(a.id));
  const seen = alerts.filter((a) => seenIds.has(a.id));

  // Módulos con avisos sin ver, los que tienen urgentes primero.
  const modules = MODULE_ORDER.filter((m) => unseen.some((a) => a.module === m)).sort((x, y) => {
    const ux = unseen.some((a) => a.module === x && alertPriority(a) === "urgent") ? 0 : 1;
    const uy = unseen.some((a) => a.module === y && alertPriority(a) === "urgent") ? 0 : 1;
    return ux - uy;
  });
  const active = filter !== "todos" && modules.includes(filter) ? filter : "todos";
  const visibleModules = active === "todos" ? modules : [active];
  const visibleSeen = active === "todos" ? seen : seen.filter((a) => a.module === active);

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
    <div className={cn("max-h-[min(26rem,70vh)] overflow-y-auto", className)}>
      {modules.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5">
          {(["todos", ...modules] as const).map((m) => {
            const n = m === "todos" ? unseen.length : unseen.filter((a) => a.module === m).length;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setFilter(m)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active === m ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {`${m === "todos" ? "Todos" : MODULE_LABEL[m]} ${n}`}
              </button>
            );
          })}
        </div>
      )}
      <div className="p-2">
        {unseen.length === 0 && (
          <p className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
            <CheckCheck className="h-4 w-4 text-success" />
            Viste todos los avisos.
          </p>
        )}
        {visibleModules.map((m) => {
          const items = unseen
            .filter((a) => a.module === m)
            .sort((x, y) => Number(alertPriority(y) === "urgent") - Number(alertPriority(x) === "urgent"));
          return (
            <section key={m} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{MODULE_LABEL[m]}</p>
              <ul>
                {items.map((a) => (
                  <AlertRow key={a.id} alert={a} seen={false} onNavigate={onNavigate} />
                ))}
              </ul>
            </section>
          );
        })}
        <div className="mt-1 flex items-center justify-between gap-2 px-2">
          {visibleSeen.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowSeen((v) => !v)}
              aria-expanded={showSeen}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSeen && "rotate-180")} />
              {`Vistos (${visibleSeen.length})`}
            </button>
          ) : (
            <span />
          )}
          {unseen.filter((a) => !a.pinned && !a.lockedPlan).length > 1 && (
            <button type="button" onClick={markAllSeen} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todo como visto
            </button>
          )}
        </div>
        {showSeen && visibleSeen.length > 0 && (
          <ul className="mt-1">
            {visibleSeen.map((a) => (
              <AlertRow key={a.id} alert={a} seen onNavigate={onNavigate} />
            ))}
          </ul>
        )}
      </div>
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
                href="/configuracion?tab=avisos"
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
