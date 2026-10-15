"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBusinessAlerts, type BusinessAlertCounts } from "@/app/(dashboard)/alertas/actions";
import { alertPriority, cashAlert, MODULE_HREF, MODULE_LABEL, type AlertModule, type BellAlert, type BellTone } from "@/lib/bell-alerts";
import { cn } from "@/lib/utils";
import { countsToAlerts } from "@/lib/alert-counts";
import type { Plan } from "@/lib/subscription";

// Una sola fuente de avisos para todo el sistema: la campana, las insignias
// del menú lateral, la tira de Productos y su campanita leen de acá, así que
// los números nunca se contradicen. Todo número cuenta AVISOS (no productos
// ni proveedores) sin contar los ya vistos.

const STALE_MS = 5 * 60 * 1000;
const SEEN_KEY = "pesito-alerts-seen";
const toneOrder: Record<BellTone, number> = { danger: 0, warning: 1, info: 2 };

export interface AlertsState {
  /** Todos los avisos (vistos o no), los urgentes primero. */
  alerts: BellAlert[];
  /** Sin ver. */
  unseen: BellAlert[];
  seen: BellAlert[];
  /** Cantidad de avisos sin ver por módulo. */
  byModule: Partial<Record<AlertModule, number>>;
  /** Cantidad de avisos sin ver por módulo que son urgentes. */
  urgentByModule: Partial<Record<AlertModule, number>>;
  total: number;
  urgentTotal: number;
  loading: boolean;
  /** Pide de nuevo lo que cuesta calcular si pasaron unos minutos (o ya). */
  refresh: (force?: boolean) => void;
  markSeen: (a: BellAlert) => void;
  markAllSeen: () => void;
  unmarkSeen: (a: BellAlert) => void;
}

const Ctx = createContext<AlertsState | null>(null);

export function useAlerts(): AlertsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAlerts va dentro de AlertsProvider");
  return v;
}

/** Igual que useAlerts pero sin romper si no hay proveedor (pantallas fuera del panel). */
export function useAlertsOptional(): AlertsState | null {
  return useContext(Ctx);
}

/** Lo que identifica "el mismo aviso": el texto lleva las cantidades, así que si cambian, vuelve a aparecer. */
const tokenOf = (a: BellAlert) => `${a.id}|${a.title}`;

export function AlertsProvider({
  serverAlerts,
  cash,
  stockLockedPlan,
  children,
}: {
  serverAlerts: BellAlert[];
  cash: { openedAt: string; closeTime: string | null } | null;
  stockLockedPlan: Plan | null;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState<BusinessAlertCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedAt = useRef(0);
  // Se recalcula el aviso de la caja (depende de la hora) cada minuto.
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    loadedAt.current = Date.now();
    const next = await getBusinessAlerts();
    if (next) setCounts(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(load, 1500);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(
    (force?: boolean) => {
      if (force || Date.now() - loadedAt.current > STALE_MS) void load();
    },
    [load]
  );

  // Avisos que se descartan al abrirlos (BellAlert.dismiss) y los "vistos": del navegador.
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});
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
    let seen: Record<string, string> = {};
    try {
      seen = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>;
    } catch {
      seen = {};
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(found);
    setSeenMap(seen);
  }, [serverAlerts]);

  const saveSeen = useCallback((next: Record<string, string>) => {
    setSeenMap(next);
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const alerts = useMemo(() => {
    void tick;
    const visibleServer = serverAlerts.filter((a) => !a.dismiss || dismissed[a.id] !== a.dismiss.token);
    const cashItem = cash ? cashAlert(cash.openedAt, cash.closeTime) : null;
    const all = [...visibleServer, ...(cashItem ? [cashItem] : []), ...countsToAlerts(counts, stockLockedPlan)];
    const prio = (a: BellAlert) => (alertPriority(a) === "urgent" ? 0 : 1);
    return all.sort((a, b) => prio(a) - prio(b) || toneOrder[a.tone] - toneOrder[b.tone]);
  }, [serverAlerts, dismissed, cash, counts, stockLockedPlan, tick]);

  const isSeen = useCallback((a: BellAlert) => !a.pinned && seenMap[a.id] === tokenOf(a), [seenMap]);

  const markSeen = useCallback(
    (a: BellAlert) => {
      if (a.pinned) return;
      saveSeen({ ...seenMap, [a.id]: tokenOf(a) });
    },
    [seenMap, saveSeen]
  );
  const unmarkSeen = useCallback(
    (a: BellAlert) => {
      const next = { ...seenMap };
      delete next[a.id];
      saveSeen(next);
    },
    [seenMap, saveSeen]
  );
  const markAllSeen = useCallback(() => {
    const next = { ...seenMap };
    for (const a of alerts) if (!a.pinned) next[a.id] = tokenOf(a);
    saveSeen(next);
  }, [alerts, seenMap, saveSeen]);

  const value = useMemo<AlertsState>(() => {
    // Los avisos bloqueados por el plan se ven en la lista pero no cuentan (no hay nada que atender hoy).
    const unseen = alerts.filter((a) => !isSeen(a));
    const seen = alerts.filter((a) => isSeen(a));
    const byModule: Partial<Record<AlertModule, number>> = {};
    const urgentByModule: Partial<Record<AlertModule, number>> = {};
    let total = 0;
    let urgentTotal = 0;
    for (const a of unseen) {
      if (a.lockedPlan) continue;
      byModule[a.module] = (byModule[a.module] ?? 0) + 1;
      total += 1;
      if (alertPriority(a) === "urgent") {
        urgentByModule[a.module] = (urgentByModule[a.module] ?? 0) + 1;
        urgentTotal += 1;
      }
    }
    return { alerts, unseen, seen, byModule, urgentByModule, total, urgentTotal, loading, refresh, markSeen, markAllSeen, unmarkSeen };
  }, [alerts, isSeen, loading, refresh, markSeen, markAllSeen, unmarkSeen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Insignia de un módulo (en el menú lateral): cuántos AVISOS sin ver tiene, no cuántos
 * productos o proveedores. Roja si alguno es urgente, naranja si no. Va por `href` del menú
 * o directo por módulo.
 */
export function ModuleBadge({ href, module, className }: { href?: string; module?: AlertModule; className?: string }) {
  const ctx = useAlertsOptional();
  if (!ctx) return null;
  const mod = module ?? (Object.keys(MODULE_HREF) as AlertModule[]).find((m) => MODULE_HREF[m] === href);
  if (!mod) return null;
  const n = ctx.byModule[mod] ?? 0;
  if (n === 0) return null;
  const urgent = (ctx.urgentByModule[mod] ?? 0) > 0;
  return (
    <span
      className={cn(
        "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-white",
        urgent ? "bg-danger" : "bg-warning",
        className
      )}
      title={`${MODULE_LABEL[mod]}: ${n === 1 ? "1 aviso" : `${n} avisos`}${urgent ? " (hay urgentes)" : ""}`}
      aria-label={n === 1 ? "1 aviso" : `${n} avisos`}
    >
      {n}
    </span>
  );
}
