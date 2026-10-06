import { formatCurrency } from "@/lib/utils";
import { daysBetween, dayKey, oldestOverdueDays, type DebtItem } from "@/lib/supplier-debt";

/** "2026-10-07" -> "7/10". */
export function shortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}/${m}`;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "hoy", "ayer", "hace 5 días", "hace 2 meses"; "—" si no hay fecha. */
export function agoLabel(iso: string | null, todayKey: string): string {
  if (!iso) return "—";
  const days = Math.max(0, daysBetween(dayKey(iso), todayKey));
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return `hace ${plural(months, "mes", "meses")}`;
}

export type DebtTone = "danger" | "warning" | "muted";

export interface DebtSummary {
  headline: string;
  tone: DebtTone;
  sub: string;
}

/** Cómo está la deuda de un proveedor, en palabras (columna "Estado de la deuda"). */
export function debtSummary(items: readonly DebtItem[]): DebtSummary | null {
  if (items.length === 0) return null;
  const overdue = items.filter((i) => i.status === "vencida");
  const dated = items
    .filter((i) => i.dueDate && i.status !== "vencida")
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  const undated = items.filter((i) => i.status === "sin_fecha");
  const undatedAmount = undated.reduce((acc, i) => acc + i.amount, 0);

  const restText = (list: readonly DebtItem[]) => {
    const parts = list.slice(0, 2).map((i) => `el ${shortDate(i.dueDate as string)}: ${formatCurrency(i.amount)}`);
    const more = list.length - 2;
    return parts.join(" · ") + (more > 0 ? ` · +${more} más` : "");
  };

  if (overdue.length > 0) {
    const days = oldestOverdueDays(items);
    const amount = overdue.reduce((acc, i) => acc + i.amount, 0);
    const extra = [dated.length > 0 ? `Vence ${restText(dated)}` : "", undatedAmount > 0 ? `${formatCurrency(undatedAmount)} sin fecha` : ""]
      .filter(Boolean)
      .join(" · ");
    return {
      headline: `Vencida hace ${plural(days, "día", "días")} · ${formatCurrency(amount)}`,
      tone: "danger",
      sub: extra,
    };
  }
  if (dated.length > 0) {
    const first = dated[0];
    const tone: DebtTone = first.status === "pronto" ? "warning" : "muted";
    const when =
      first.daysToDue === 0
        ? "Vence hoy"
        : first.daysToDue === 1
          ? "Vence mañana"
          : `Vence el ${shortDate(first.dueDate as string)}`;
    return {
      headline: `${when} · ${formatCurrency(first.amount)}`,
      tone,
      sub: [dated.length > 1 ? `Después ${restText(dated.slice(1))}` : "", undatedAmount > 0 ? `${formatCurrency(undatedAmount)} sin fecha` : ""]
        .filter(Boolean)
        .join(" · "),
    };
  }
  const oldest = Math.max(...undated.map((i) => i.ageDays));
  return {
    headline: "Sin fecha de vencimiento",
    tone: "muted",
    sub: `Deuda de hace ${plural(oldest, "día", "días")}`,
  };
}

export interface NextPayment {
  amount: number;
  /** "vencida hace 3 días", "mañana", "el 12/10", "sin fecha". */
  when: string;
  tone: DebtTone;
  /** Otras partes de la deuda que no entran en este monto. */
  more: number;
}

/**
 * Lo próximo que hay que pagarle a un proveedor, como "monto · cuándo": lo
 * vencido si hay; si no, lo que vence antes; si nada tiene fecha, todo sin fecha.
 */
export function nextPayment(items: readonly DebtItem[]): NextPayment | null {
  if (items.length === 0) return null;
  const overdue = items.filter((i) => i.status === "vencida");
  if (overdue.length > 0) {
    const days = oldestOverdueDays(items);
    return {
      amount: overdue.reduce((acc, i) => acc + i.amount, 0),
      when: `vencida hace ${plural(days, "día", "días")}`,
      tone: "danger",
      more: items.length - overdue.length,
    };
  }
  const dated = items
    .filter((i) => i.dueDate)
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  if (dated.length > 0) {
    const first = dated[0];
    const sameDay = dated.filter((i) => i.dueDate === first.dueDate);
    return {
      amount: sameDay.reduce((acc, i) => acc + i.amount, 0),
      when:
        first.daysToDue === 0
          ? "hoy"
          : first.daysToDue === 1
            ? "mañana"
            : `el ${shortDate(first.dueDate as string)}`,
      tone: first.status === "pronto" ? "warning" : "muted",
      more: items.length - sameDay.length,
    };
  }
  return {
    amount: items.reduce((acc, i) => acc + i.amount, 0),
    when: "sin fecha",
    tone: "muted",
    more: 0,
  };
}
