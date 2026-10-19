import type { BellAlert } from "@/lib/bell-alerts";
import { alertEnabled, type AlertSettings } from "@/lib/alert-config";
import { formatCurrency } from "@/lib/utils";

// Faltantes y sobrantes al cerrar la caja. Una sola cuenta para la pantalla Caja ("Faltantes
// repetidos") y para los avisos de la campana, así los números coinciden. Un faltante suelto
// pasa; el problema es cuando se repite.

/** Diferencia mínima (en $) para contar un cierre como faltante o sobrante. */
export const FALTANTE_THRESHOLD = 100;
/** Proporción de los últimos cierres de una persona con faltante para avisar. */
export const FALTANTE_RATIO_ALERT = 0.6;
/** Cuántos cierres recientes de cada persona se miran. */
export const RECENT_CLOSES_PER_USER = 5;
/** Con menos cierres que esto no se juzga a nadie. */
export const MIN_CLOSES_TO_JUDGE = 3;
/** Ventana de "diferencias recientes". */
export const DIFFERENCE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ClosedRegisterRow {
  user_id: string;
  expected_amount: number | string | null;
  closing_amount: number | string | null;
  closed_at: string | null;
}

export interface RecurringShortage {
  userId: string;
  faltanteCount: number;
  consideredCount: number;
  totalFaltante: number;
}

/** Quién cerró con faltante en la mayoría de sus últimos cierres (de más a menos plata). `rows` viene del más nuevo al más viejo. */
export function recurringShortages(rows: ClosedRegisterRow[], threshold = FALTANTE_THRESHOLD): RecurringShortage[] {
  const byUser = new Map<string, { expected: number; closing: number }[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    if (list.length < RECENT_CLOSES_PER_USER) {
      list.push({ expected: Number(r.expected_amount ?? 0), closing: Number(r.closing_amount ?? 0) });
    }
    byUser.set(r.user_id, list);
  }
  return Array.from(byUser.entries())
    .map(([userId, closes]) => {
      const faltantes = closes.filter((c) => c.closing - c.expected < -threshold);
      return {
        userId,
        faltanteCount: faltantes.length,
        consideredCount: closes.length,
        totalFaltante: faltantes.reduce((acc, c) => acc + (c.expected - c.closing), 0),
      };
    })
    .filter((row) => row.consideredCount >= MIN_CLOSES_TO_JUDGE && row.faltanteCount / row.consideredCount >= FALTANTE_RATIO_ALERT)
    .sort((a, b) => b.totalFaltante - a.totalFaltante);
}

export interface RecentDifferences {
  /** Cierres con diferencia (en más o en menos) mayor al umbral. */
  count: number;
  /** Plata que faltó y plata que sobró, sumadas. */
  shortage: number;
  surplus: number;
}

export function recentDifferences(rows: ClosedRegisterRow[], threshold: number, now: Date = new Date()): RecentDifferences {
  const since = now.getTime() - DIFFERENCE_DAYS * DAY_MS;
  const out: RecentDifferences = { count: 0, shortage: 0, surplus: 0 };
  for (const r of rows) {
    if (!r.closed_at || new Date(r.closed_at).getTime() < since) continue;
    const diff = Number(r.closing_amount ?? 0) - Number(r.expected_amount ?? 0);
    if (Math.abs(diff) <= threshold) continue;
    out.count += 1;
    if (diff < 0) out.shortage += -diff;
    else out.surplus += diff;
  }
  return out;
}

export interface CashAlertCounts {
  differences: RecentDifferences;
  repeated: { label: string; faltanteCount: number; consideredCount: number; totalFaltante: number }[];
  threshold: number;
}

/** Avisos de la caja por plata (faltantes y sobrantes), sin los que el negocio apagó. */
export function cashAlerts(counts: CashAlertCounts | null, settings: AlertSettings): BellAlert[] {
  if (!counts) return [];
  const out: BellAlert[] = [];
  const rep = counts.repeated;
  if (alertEnabled(settings, "cash-shortage-repeat") && rep.length > 0) {
    const first = rep[0];
    out.push({
      id: "cash-shortage-repeat",
      module: "caja",
      priority: "urgent",
      tone: "warning",
      title:
        rep.length === 1
          ? `${first.label} cerró con faltante en ${first.faltanteCount} de sus últimos ${first.consideredCount} cierres`
          : `${rep.length} personas con faltantes repetidos en la caja`,
      chip: rep.length === 1 ? "faltantes repetidos" : `${rep.length} con faltantes repetidos`,
      detail:
        rep.length === 1
          ? `En total faltaron ${formatCurrency(first.totalFaltante)}. Un faltante suelto pasa; repetido, conviene hablarlo.`
          : `El mayor: ${first.label}, ${formatCurrency(first.totalFaltante)} en total. Mirá el detalle en Caja.`,
      href: "/caja",
    });
  }
  const d = counts.differences;
  if (alertEnabled(settings, "cash-difference") && d.count > 0) {
    const parts = [d.shortage > 0 ? `faltaron ${formatCurrency(d.shortage)}` : null, d.surplus > 0 ? `sobraron ${formatCurrency(d.surplus)}` : null].filter(
      (p): p is string => p !== null
    );
    out.push({
      id: "cash-difference",
      module: "caja",
      tone: d.shortage > 0 ? "warning" : "info",
      title: d.count === 1 ? `1 cierre de caja con diferencia en los últimos ${DIFFERENCE_DAYS} días` : `${d.count} cierres de caja con diferencia en los últimos ${DIFFERENCE_DAYS} días`,
      chip: d.count === 1 ? "1 diferencia de caja" : `${d.count} diferencias de caja`,
      detail: `En total ${parts.join(" y ")}. Se cuentan las diferencias de más de ${formatCurrency(counts.threshold)}.`,
      href: "/caja",
    });
  }
  return out;
}
