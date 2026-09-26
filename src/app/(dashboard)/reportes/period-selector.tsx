"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { PlanPill, PlanLockNote } from "@/components/dashboard/pro-locked-card";
import {
  compareOptions,
  morePeriodOptions,
  periodOptions,
  reportesHref,
  MAX_CUSTOM_DAYS,
  type CompareMode,
  type ReportQuery,
} from "@/lib/report-periods";
import { cn } from "@/lib/utils";

// Período de Reportes: atajos, "Más", fechas a medida (Plan Esencial) y con
// qué comparar (Plan Pro). Sin el plan se ven igual, con su etiqueta.
export function PeriodSelector({
  query,
  sellerId,
  rangeLabel,
  today,
  canCustomRange,
  canCompare,
}: {
  query: ReportQuery;
  sellerId: string | null;
  /** "del 1/9/26 al 15/9/26": se muestra con un rango a medida. */
  rangeLabel: string;
  /** YYYY-MM-DD de hoy en Argentina (máximo del selector de fechas). */
  today: string;
  canCustomRange: boolean;
  canCompare: boolean;
}) {
  const router = useRouter();
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(query.from ?? "");
  const [to, setTo] = useState(query.to ?? today);
  const [error, setError] = useState<string | null>(null);
  const withPeriod = (period: ReportQuery["period"]) =>
    reportesHref({ ...query, period, from: null, to: null }, sellerId);
  const inMore = morePeriodOptions.some((o) => o.value === query.period);

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return setError("Elegí las dos fechas.");
    const [a, b] = from <= to ? [from, to] : [to, from];
    const days = (new Date(b).getTime() - new Date(a).getTime()) / 86400000 + 1;
    if (days > MAX_CUSTOM_DAYS) return setError("Elegí un rango de hasta un año.");
    setCustomOpen(false);
    router.push(reportesHref({ ...query, period: "custom", from: a, to: b }, sellerId));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-xl border border-border bg-card p-1">
        {periodOptions.map((option) => (
          <Link
            key={option.value}
            href={withPeriod(option.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              query.period === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            query.period === "custom"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {query.period === "custom" ? rangeLabel : "Personalizado"}
          {!canCustomRange && <PlanPill plan="esencial" />}
        </button>
      </div>

      <select
        aria-label="Más períodos"
        value={inMore ? query.period : ""}
        onChange={(e) => e.target.value && router.push(withPeriod(e.target.value as ReportQuery["period"]))}
        className={cn(
          "h-10 rounded-xl border border-border bg-card px-3 text-sm",
          inMore ? "font-medium text-foreground" : "text-muted-foreground"
        )}
      >
        <option value="">Más períodos…</option>
        {morePeriodOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Comparar con
        {canCompare ? (
          <select
            value={query.compare}
            onChange={(e) =>
              router.push(reportesHref({ ...query, compare: e.target.value as CompareMode }, sellerId))
            }
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
          >
            {compareOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <Link
            href="/suscribirse?plan=pro"
            prefetch={false}
            className="flex h-10 items-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Período anterior
            <PlanPill plan="pro" />
          </Link>
        )}
      </label>

      <Dialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Fechas a medida"
        description="Elegí desde y hasta qué día ver los reportes (hasta un año)."
      >
        {canCustomRange ? (
          <form onSubmit={applyCustom} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Desde</span>
                <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} required />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Hasta</span>
                <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} required />
              </label>
            </div>
            {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCustomOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Ver reportes</Button>
            </div>
          </form>
        ) : (
          <PlanLockNote plan="esencial">
            Con el Plan Esencial elegís las fechas que quieras: del 1 al 15 del mes, una temporada o
            un fin de semana largo.
          </PlanLockNote>
        )}
      </Dialog>
    </div>
  );
}
