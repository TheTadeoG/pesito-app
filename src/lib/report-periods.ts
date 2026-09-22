export type ReportPeriod = "today" | "7d" | "30d" | "month";

export const periodOptions: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Este mes" },
];

export function resolvePeriod(value: string | string[] | undefined): ReportPeriod {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "today" || v === "7d" || v === "30d" || v === "month") return v;
  return "30d";
}

export interface PeriodRange {
  start: Date;
  label: string;
  groupBy: "hour" | "day";
}

export function getPeriodRange(period: ReportPeriod): PeriodRange {
  const now = new Date();

  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, label: "hoy", groupBy: "hour" };
  }

  if (period === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, label: "en los últimos 7 días", groupBy: "day" };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, label: "este mes", groupBy: "day" };
  }

  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, label: "en los últimos 30 días", groupBy: "day" };
}

/** Number of calendar days from `start` through today, inclusive. */
export function daysSince(start: Date): number {
  return Math.max(1, Math.round((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}
