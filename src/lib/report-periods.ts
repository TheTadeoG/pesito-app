import { argDateString, argMidnightUTC } from "@/lib/timezone";

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

/** Link a Reportes con el período y, si hay, el vendedor elegido. */
export function reportesHref(period: ReportPeriod, sellerId: string | null = null): string {
  return sellerId
    ? `/reportes?period=${period}&vendedor=${sellerId}`
    : `/reportes?period=${period}`;
}

export interface PeriodRange {
  start: Date;
  label: string;
  groupBy: "hour" | "day";
}

export function getPeriodRange(period: ReportPeriod): PeriodRange {
  const todayStr = argDateString();
  const todayMidnight = argMidnightUTC(todayStr);

  if (period === "today") {
    return { start: todayMidnight, label: "hoy", groupBy: "hour" };
  }

  if (period === "7d") {
    const start = new Date(todayMidnight);
    start.setUTCDate(start.getUTCDate() - 6);
    return { start, label: "en los últimos 7 días", groupBy: "day" };
  }

  if (period === "month") {
    const [year, month] = todayStr.split("-");
    const start = argMidnightUTC(`${year}-${month}-01`);
    return { start, label: "este mes", groupBy: "day" };
  }

  const start = new Date(todayMidnight);
  start.setUTCDate(start.getUTCDate() - 29);
  return { start, label: "en los últimos 30 días", groupBy: "day" };
}

/**
 * Number of calendar days from `start` through today, inclusive.
 *
 * Compara contra la medianoche de "hoy" (no contra `Date.now()`): usar la
 * hora exacta hacía que el redondeo dependiera de qué hora era cuando se
 * pedía el reporte — a la tarde ya redondeaba para arriba y sumaba un día
 * de más (el gráfico terminaba mostrando "mañana" en vez de hoy, corriendo
 * todas las barras un lugar respecto de sus fechas en el eje).
 */
export function daysSince(start: Date): number {
  const todayMidnight = argMidnightUTC(argDateString());
  return Math.max(
    1,
    Math.round((todayMidnight.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
}
