// Deuda con proveedores: qué parte de lo que se debe vence cuándo.
//
// Cada compra a cuenta (purchases.account_amount) puede tener un vencimiento
// (purchases.due_date). Los pagos no se asignan a una compra puntual: se
// aplican primero a la que vence antes (y, sin fecha, a la más vieja). Eso se
// calcula acá, a partir del saldo actual del proveedor, sin guardar nada.

export const SOON_DAYS = 7;
export const TIME_ZONE = "America/Argentina/Buenos_Aires";

export interface DebtPurchase {
  id: string;
  supplierId: string;
  accountAmount: number;
  createdAt: string;
  /** YYYY-MM-DD o null (sin fecha). */
  dueDate: string | null;
}

export type DebtStatus = "vencida" | "pronto" | "no_vencida" | "sin_fecha";

export interface DebtItem {
  /** null: saldo que no sale de ninguna compra (ajuste). */
  purchaseId: string | null;
  supplierId: string;
  amount: number;
  /** Día de la compra (YYYY-MM-DD). */
  purchaseDay: string;
  dueDate: string | null;
  status: DebtStatus;
  /** Días hasta el vencimiento (negativo = vencida hace N). null sin fecha. */
  daysToDue: number | null;
  /** Días desde la compra. */
  ageDays: number;
}

/** YYYY-MM-DD de un instante, en hora argentina. */
export function dayKey(value: string | number | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(value));
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return dayNumber(toKey) - dayNumber(fromKey);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function classify(dueDate: string | null, todayKey: string): { status: DebtStatus; daysToDue: number | null } {
  if (!dueDate) return { status: "sin_fecha", daysToDue: null };
  const diff = daysBetween(todayKey, dueDate);
  if (diff < 0) return { status: "vencida", daysToDue: diff };
  if (diff <= SOON_DAYS) return { status: "pronto", daysToDue: diff };
  return { status: "no_vencida", daysToDue: diff };
}

/**
 * Lo que sigue debiéndose, compra por compra. `balances` es el saldo actual
 * de cada proveedor; lo ya pagado se descuenta de las compras que vencen antes.
 */
export function outstandingItems(
  purchases: readonly DebtPurchase[],
  balances: ReadonlyMap<string, number>,
  todayKey: string
): DebtItem[] {
  const bySupplier = new Map<string, DebtPurchase[]>();
  for (const p of purchases) {
    if (p.accountAmount <= 0) continue;
    const list = bySupplier.get(p.supplierId) ?? [];
    list.push(p);
    bySupplier.set(p.supplierId, list);
  }

  const items: DebtItem[] = [];
  for (const [supplierId, balanceRaw] of balances) {
    const balance = Math.round(balanceRaw * 100) / 100;
    if (balance <= 0) continue;
    const list = (bySupplier.get(supplierId) ?? [])
      .map((p) => ({ p, day: dayKey(p.createdAt) }))
      .sort((a, b) => {
        const ka = a.p.dueDate ?? a.day;
        const kb = b.p.dueDate ?? b.day;
        return ka.localeCompare(kb) || a.p.createdAt.localeCompare(b.p.createdAt);
      });
    const accounted = list.reduce((acc, x) => acc + x.p.accountAmount, 0);
    // Lo pagado (o anulado) sale primero de lo que vence antes.
    let toDiscount = Math.max(0, accounted - balance);
    for (const { p, day } of list) {
      let amount = p.accountAmount;
      const used = Math.min(amount, toDiscount);
      amount -= used;
      toDiscount -= used;
      if (amount <= 0.004) continue;
      items.push({
        purchaseId: p.id,
        supplierId,
        amount: Math.round(amount * 100) / 100,
        purchaseDay: day,
        dueDate: p.dueDate,
        ...classify(p.dueDate, todayKey),
        ageDays: Math.max(0, daysBetween(day, todayKey)),
      });
    }
    // Saldo que no sale de compras cargadas (ajustes): sin fecha.
    const extra = balance - Math.max(0, accounted);
    if (extra > 0.004) {
      const day = list.length > 0 ? list[list.length - 1].day : todayKey;
      items.push({
        purchaseId: null,
        supplierId,
        amount: Math.round(extra * 100) / 100,
        purchaseDay: day,
        dueDate: null,
        status: "sin_fecha",
        daysToDue: null,
        ageDays: Math.max(0, daysBetween(day, todayKey)),
      });
    }
  }
  return items;
}

export interface DebtTotals {
  total: number;
  vencida: number;
  pronto: number;
  no_vencida: number;
  sin_fecha: number;
  /** Por antigüedad de la compra. */
  hasta7: number;
  de8a30: number;
  mas30: number;
}

export function totalsOf(items: readonly DebtItem[]): DebtTotals {
  const t: DebtTotals = {
    total: 0,
    vencida: 0,
    pronto: 0,
    no_vencida: 0,
    sin_fecha: 0,
    hasta7: 0,
    de8a30: 0,
    mas30: 0,
  };
  for (const i of items) {
    t.total += i.amount;
    t[i.status] += i.amount;
    if (i.ageDays <= 7) t.hasta7 += i.amount;
    else if (i.ageDays <= 30) t.de8a30 += i.amount;
    else t.mas30 += i.amount;
  }
  return t;
}

/** El vencimiento más próximo que todavía no pasó (si hay). */
export function nextDue(items: readonly DebtItem[]): DebtItem | null {
  let best: DebtItem | null = null;
  for (const i of items) {
    if (!i.dueDate || (i.daysToDue ?? -1) < 0) continue;
    if (!best || i.dueDate < (best.dueDate as string)) best = i;
  }
  return best;
}

/** Cuánto hace que venció la deuda más vieja (0 si nada venció). */
export function oldestOverdueDays(items: readonly DebtItem[]): number {
  let max = 0;
  for (const i of items) if (i.status === "vencida") max = Math.max(max, -(i.daysToDue ?? 0));
  return max;
}

/** Orden por urgencia para la lista (menor = más urgente). */
export function urgencyRank(items: readonly DebtItem[]): number {
  if (items.some((i) => i.status === "vencida")) return 0;
  if (items.some((i) => i.status === "pronto")) return 1;
  if (items.some((i) => i.status === "no_vencida")) return 2;
  if (items.length > 0) return 3;
  return 4;
}

/** Día de la semana de una fecha YYYY-MM-DD: 0 = lunes ... 6 = domingo. */
export function weekdayIndex(key: string): number {
  return (dayNumber(key) + 3) % 7;
}

export interface CalendarEvent {
  /** YYYY-MM-DD */
  day: string;
  kind: "vencimiento" | "entrega";
  supplierId: string;
  supplierName: string;
  /** Sólo vencimientos. */
  amount?: number;
  status?: DebtStatus;
  /** Compras que vencen ese día (para pagar / cambiar la fecha). */
  purchaseIds?: string[];
}

/** Vencimientos (con su estado) y entregas semanales entre dos fechas, inclusive. */
export function calendarEvents(
  suppliers: readonly { id: string; name: string; deliveryDays: readonly number[]; items: readonly DebtItem[] }[],
  fromKey: string,
  toKey: string
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const span = daysBetween(fromKey, toKey);
  for (const s of suppliers) {
    const byDay = new Map<string, CalendarEvent>();
    for (const i of s.items) {
      if (!i.dueDate || i.dueDate < fromKey || i.dueDate > toKey) continue;
      const cur = byDay.get(i.dueDate) ?? {
        day: i.dueDate,
        kind: "vencimiento" as const,
        supplierId: s.id,
        supplierName: s.name,
        amount: 0,
        status: i.status,
        purchaseIds: [],
      };
      cur.amount = (cur.amount ?? 0) + i.amount;
      if (i.purchaseId) cur.purchaseIds?.push(i.purchaseId);
      byDay.set(i.dueDate, cur);
    }
    events.push(...byDay.values());
    if (s.deliveryDays.length > 0) {
      for (let n = 0; n <= span; n++) {
        const day = addDays(fromKey, n);
        if (s.deliveryDays.includes(weekdayIndex(day))) {
          events.push({ day, kind: "entrega", supplierId: s.id, supplierName: s.name });
        }
      }
    }
  }
  return events.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (a.kind === b.kind ? 0 : a.kind === "vencimiento" ? -1 : 1) ||
      a.supplierName.localeCompare(b.supplierName, "es")
  );
}
