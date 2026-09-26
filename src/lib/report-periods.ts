import { argDateString, argMidnightUTC } from "@/lib/timezone";

// Períodos de Reportes: atajos, rango personalizado (desde/hasta, Plan
// Esencial) y con qué se compara (Plan Pro). Todo en días de Argentina.

export type ReportPeriod =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "lastmonth"
  | "year";

export type CompareMode = "previous" | "year" | "none";

export interface ReportQuery {
  period: ReportPeriod | "custom";
  /** YYYY-MM-DD, sólo con period "custom". */
  from: string | null;
  to: string | null;
  compare: CompareMode;
}

/** Los que se ven siempre; el resto va en "Más". */
export const periodOptions: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Este mes" },
];

export const morePeriodOptions: { value: ReportPeriod; label: string }[] = [
  { value: "yesterday", label: "Ayer" },
  { value: "lastmonth", label: "Mes pasado" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "year", label: "Este año" },
];

export const compareOptions: { value: CompareMode; label: string }[] = [
  { value: "previous", label: "Período anterior" },
  { value: "year", label: "Mismo período del año pasado" },
  { value: "none", label: "No comparar" },
];

const PRESETS: ReportPeriod[] = [...periodOptions, ...morePeriodOptions].map((o) => o.value);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Rango personalizado máximo (para no traer años de ventas de una vez). */
export const MAX_CUSTOM_DAYS = 366;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function resolvePeriod(value: string | string[] | undefined): ReportPeriod {
  const v = first(value);
  return PRESETS.includes(v as ReportPeriod) ? (v as ReportPeriod) : "30d";
}

/**
 * Lee el período de la URL. Un rango personalizado inválido (o sin permiso
 * del plan) vuelve a "30 días".
 */
export function resolveReportQuery(
  params: { period?: string; desde?: string; hasta?: string; comparar?: string },
  options: { allowCustom: boolean }
): ReportQuery {
  const compare: CompareMode =
    params.comparar === "anio" ? "year" : params.comparar === "no" ? "none" : "previous";
  if (params.period === "custom" && options.allowCustom) {
    const from = params.desde ?? "";
    const to = params.hasta ?? "";
    if (DATE_RE.test(from) && DATE_RE.test(to)) {
      const [a, b] = from <= to ? [from, to] : [to, from];
      const days = Math.round((argMidnightUTC(b).getTime() - argMidnightUTC(a).getTime()) / DAY_MS) + 1;
      if (days <= MAX_CUSTOM_DAYS && b <= argDateString()) {
        return { period: "custom", from: a, to: b, compare };
      }
    }
  }
  return { period: resolvePeriod(params.period), from: null, to: null, compare };
}

/** Link a Reportes con el período, la comparación y, si hay, el vendedor. */
export function reportesHref(query: ReportQuery, sellerId: string | null = null): string {
  const params = new URLSearchParams({ period: query.period });
  if (query.period === "custom" && query.from && query.to) {
    params.set("desde", query.from);
    params.set("hasta", query.to);
  }
  if (query.compare === "year") params.set("comparar", "anio");
  if (query.compare === "none") params.set("comparar", "no");
  if (sellerId) params.set("vendedor", sellerId);
  return `/reportes?${params.toString()}`;
}

export interface PeriodRange {
  start: Date;
  /** Exclusivo: medianoche del día siguiente al último del período. */
  end: Date;
  label: string;
  groupBy: "hour" | "day" | "month";
  /** Días del período (para el gráfico por día). */
  days: number;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function shortDate(dateString: string): string {
  const [y, m, d] = dateString.split("-");
  return `${Number(d)}/${Number(m)}/${y.slice(2)}`;
}

function build(start: Date, end: Date, label: string): PeriodRange {
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  return { start, end, label, days, groupBy: days === 1 ? "hour" : days > 92 ? "month" : "day" };
}

export function getReportRange(query: ReportQuery): PeriodRange {
  const todayStr = argDateString();
  const today = argMidnightUTC(todayStr);
  const tomorrow = addDays(today, 1);
  const [year, month] = todayStr.split("-");

  if (query.period === "custom" && query.from && query.to) {
    const label = query.from === query.to ? `el ${shortDate(query.from)}` : `del ${shortDate(query.from)} al ${shortDate(query.to)}`;
    return build(argMidnightUTC(query.from), addDays(argMidnightUTC(query.to), 1), label);
  }

  switch (query.period) {
    case "today":
      return build(today, tomorrow, "hoy");
    case "yesterday":
      return build(addDays(today, -1), today, "ayer");
    case "7d":
      return build(addDays(today, -6), tomorrow, "en los últimos 7 días");
    case "90d":
      return build(addDays(today, -89), tomorrow, "en los últimos 90 días");
    case "month":
      return build(argMidnightUTC(`${year}-${month}-01`), tomorrow, "este mes");
    case "lastmonth": {
      const m = Number(month);
      const prevYear = m === 1 ? Number(year) - 1 : Number(year);
      const prevMonth = m === 1 ? 12 : m - 1;
      return build(
        argMidnightUTC(`${prevYear}-${String(prevMonth).padStart(2, "0")}-01`),
        argMidnightUTC(`${year}-${month}-01`),
        "el mes pasado"
      );
    }
    case "year":
      return build(argMidnightUTC(`${year}-01-01`), tomorrow, "este año");
    default:
      return build(addDays(today, -29), tomorrow, "en los últimos 30 días");
  }
}

/** Compatibilidad (Stock → movimientos): rango de un atajo. */
export function getPeriodRange(period: ReportPeriod): PeriodRange {
  return getReportRange({ period, from: null, to: null, compare: "none" });
}

/**
 * Período con el que se compara:
 * - "previous": la misma cantidad de días justo antes (estándar de los
 *   tableros: últimos 7 días vs. los 7 anteriores). Para "hoy" o "este
 *   mes", que todavía no terminaron, se compara hasta el mismo momento.
 * - "year": las mismas fechas del año pasado.
 */
export function getCompareRange(
  range: PeriodRange,
  mode: CompareMode,
  now = new Date()
): { start: Date; end: Date; label: string } | null {
  if (mode === "none") return null;
  // Período en curso: sólo lo transcurrido, para comparar parejo.
  const effectiveEnd = range.end > now ? now : range.end;
  const duration = effectiveEnd.getTime() - range.start.getTime();
  if (mode === "year") {
    const shift = (d: Date) => {
      const x = new Date(d);
      x.setUTCFullYear(x.getUTCFullYear() - 1);
      return x;
    };
    return { start: shift(range.start), end: shift(effectiveEnd), label: "el mismo período del año pasado" };
  }
  const periodMs = range.end.getTime() - range.start.getTime();
  const start = new Date(range.start.getTime() - periodMs);
  return { start, end: new Date(start.getTime() + duration), label: "el período anterior" };
}
