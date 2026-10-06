import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import type { Supplier } from "@/lib/types";
import {
  addDays,
  dayKey,
  daysBetween,
  outstandingItems,
  todayInArgentina,
  type DebtItem,
  type DebtPurchase,
} from "@/lib/supplier-debt";

// Datos de Proveedores (panel y calendario): se arman en el servidor y viajan
// ya calculados al cliente.

export interface SupplierRow extends Supplier {
  totalPurchased: number;
  lastPurchaseAt: string | null;
  lastPaymentAt: string | null;
  /** Lo que se le debe, compra por compra (ver lib/supplier-debt.ts). */
  items: DebtItem[];
}

export interface MonthlyPoint {
  label: string;
  compras: number;
  pagos: number;
}

export interface TopSupplier {
  name: string;
  amount: number;
  pct: number;
}

export interface SupplierOverview {
  todayKey: string;
  rows: SupplierRow[];
  monthly: MonthlyPoint[];
  top: TopSupplier[];
  topTotal: number;
  paid30: { total: number; count: number; byMethod: Record<string, number> };
  account30: { total: number; count: number };
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Vencimiento de cada compra a cuenta (purchase id -> YYYY-MM-DD). Si la
 * migración 0056 todavía no está aplicada, la consulta falla y todo queda
 * "sin fecha".
 */
export async function loadPurchaseDueDates(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const dues = await fetchAll((from, to) =>
      supabase
        .from("purchases")
        .select("id, due_date")
        .eq("org_id", orgId)
        .eq("status", "completada")
        .not("due_date", "is", null)
        .order("id")
        .range(from, to)
    );
    for (const d of dues) if (d.due_date) map.set(d.id, d.due_date);
  } catch {
    // sin migración 0056
  }
  return map;
}

export async function loadSupplierOverview(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SupplierOverview> {
  const [{ data: suppliersRaw }, purchases, payments] = await Promise.all([
    supabase.from("suppliers").select("*").eq("org_id", orgId).order("name"),
    fetchAll((from, to) =>
      supabase
        .from("purchases")
        .select("id, supplier_id, total, account_amount, created_at")
        .eq("org_id", orgId)
        .eq("status", "completada")
        .not("supplier_id", "is", null)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from("supplier_payments")
        .select("id, supplier_id, amount, method, created_at")
        .eq("org_id", orgId)
        .gte("created_at", new Date(Date.now() - 200 * 86_400_000).toISOString())
        .order("id")
        .range(from, to)
    ),
  ]);

  const dueByPurchase = await loadPurchaseDueDates(supabase, orgId);

  const todayKey = dayKey(Date.now());
  const suppliers = suppliersRaw ?? [];
  const nameById = new Map(suppliers.map((s) => [s.id, s.name]));

  const debtPurchases: DebtPurchase[] = purchases
    .filter((p) => Number(p.account_amount ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      supplierId: p.supplier_id as string,
      accountAmount: Number(p.account_amount),
      createdAt: p.created_at,
      dueDate: dueByPurchase.get(p.id) ?? null,
    }));
  const balances = new Map(suppliers.map((s) => [s.id, Number(s.balance)]));
  const items = outstandingItems(debtPurchases, balances, todayKey);
  const itemsBySupplier = new Map<string, DebtItem[]>();
  for (const i of items) {
    const list = itemsBySupplier.get(i.supplierId) ?? [];
    list.push(i);
    itemsBySupplier.set(i.supplierId, list);
  }

  const totals = new Map<string, { total: number; last: string }>();
  for (const p of purchases) {
    const id = p.supplier_id as string;
    const current = totals.get(id) ?? { total: 0, last: p.created_at };
    current.total += Number(p.total);
    if (p.created_at > current.last) current.last = p.created_at;
    totals.set(id, current);
  }
  const lastPayment = new Map<string, string>();
  for (const p of payments) {
    const prev = lastPayment.get(p.supplier_id);
    if (!prev || p.created_at > prev) lastPayment.set(p.supplier_id, p.created_at);
  }

  const rows: SupplierRow[] = suppliers.map((s) => ({
    ...s,
    balance: Number(s.balance),
    totalPurchased: totals.get(s.id)?.total ?? 0,
    lastPurchaseAt: totals.get(s.id)?.last ?? null,
    lastPaymentAt: lastPayment.get(s.id) ?? null,
    items: itemsBySupplier.get(s.id) ?? [],
  }));

  // Compras y pagos de los últimos 6 meses ("pagos": lo pagado al contado
  // más lo abonado a cuenta).
  const [ty, tm] = todayKey.split("-").map(Number);
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const monthly: MonthlyPoint[] = monthKeys.map((k) => ({
    label: MONTHS[Number(k.slice(5)) - 1],
    compras: 0,
    pagos: 0,
  }));
  const monthIndex = new Map(monthKeys.map((k, i) => [k, i]));
  for (const p of purchases) {
    const idx = monthIndex.get(dayKey(p.created_at).slice(0, 7));
    if (idx === undefined) continue;
    monthly[idx].compras += Number(p.total);
    monthly[idx].pagos += Math.max(0, Number(p.total) - Number(p.account_amount ?? 0));
  }
  for (const p of payments) {
    const idx = monthIndex.get(dayKey(p.created_at).slice(0, 7));
    if (idx !== undefined) monthly[idx].pagos += Number(p.amount);
  }

  // Últimos 30 días.
  const since = addDays(todayKey, -30);
  const inLast30 = (iso: string) => daysBetween(since, dayKey(iso)) >= 0;
  const spendBySupplier = new Map<string, number>();
  let account30 = { total: 0, count: 0 };
  for (const p of purchases) {
    if (!inLast30(p.created_at)) continue;
    const id = p.supplier_id as string;
    spendBySupplier.set(id, (spendBySupplier.get(id) ?? 0) + Number(p.total));
    if (Number(p.account_amount ?? 0) > 0) {
      account30 = { total: account30.total + Number(p.account_amount), count: account30.count + 1 };
    }
  }
  const paid30 = { total: 0, count: 0, byMethod: {} as Record<string, number> };
  for (const p of payments) {
    if (!inLast30(p.created_at)) continue;
    paid30.total += Number(p.amount);
    paid30.count += 1;
    paid30.byMethod[p.method] = (paid30.byMethod[p.method] ?? 0) + Number(p.amount);
  }

  const topTotal = Array.from(spendBySupplier.values()).reduce((a, b) => a + b, 0);
  const sorted = Array.from(spendBySupplier.entries()).sort((a, b) => b[1] - a[1]);
  const top: TopSupplier[] = sorted.slice(0, 4).map(([id, amount]) => ({
    name: nameById.get(id) ?? "Proveedor eliminado",
    amount,
    pct: topTotal > 0 ? Math.round((amount / topTotal) * 100) : 0,
  }));

  return { todayKey, rows, monthly, top, topTotal, paid30, account30 };
}

/**
 * Cuántos proveedores tienen deuda vencida (para el numerito del menú).
 * Liviano: sólo mira a los proveedores con saldo y sus compras a cuenta. Si
 * algo falla devuelve 0 (no tiene que romper el menú).
 */
export async function countOverdueSuppliers(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<number> {
  try {
    const { data: debtors } = await supabase
      .from("suppliers")
      .select("id, balance")
      .eq("org_id", orgId)
      .gt("balance", 0);
    if (!debtors || debtors.length === 0) return 0;

    const ids = debtors.map((d) => d.id);
    const columns = "id, supplier_id, account_amount, created_at";
    let rows: { id: string; supplier_id: string | null; account_amount: number | null; created_at: string; due_date?: string | null }[];
    try {
      rows = await fetchAllIn(ids, (chunk, from, to) =>
        supabase
          .from("purchases")
          .select(`${columns}, due_date`)
          .eq("org_id", orgId)
          .eq("status", "completada")
          .gt("account_amount", 0)
          .in("supplier_id", chunk)
          .order("id")
          .range(from, to)
      );
    } catch {
      // Sin la migración 0056 no hay vencimientos: nada puede estar vencido.
      return 0;
    }

    const purchases: DebtPurchase[] = rows.map((p) => ({
      id: p.id,
      supplierId: p.supplier_id as string,
      accountAmount: Number(p.account_amount),
      createdAt: p.created_at,
      dueDate: p.due_date ?? null,
    }));
    const items = outstandingItems(
      purchases,
      new Map(debtors.map((d) => [d.id, Number(d.balance)])),
      todayInArgentina()
    );
    return new Set(items.filter((i) => i.status === "vencida").map((i) => i.supplierId)).size;
  } catch {
    return 0;
  }
}
