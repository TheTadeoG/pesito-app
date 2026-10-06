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
  /** Lo que se le debe, compra por compra (ver lib/supplier-debt.ts). */
  items: DebtItem[];
}

export interface TopSupplier {
  name: string;
  amount: number;
  pct: number;
}

export interface SupplierOverview {
  todayKey: string;
  rows: SupplierRow[];
  top: TopSupplier[];
  topTotal: number;
}

/**
 * Vencimiento y lo ya pagado de cada compra a cuenta. Si la migración 0056
 * (vencimientos) o la 0058 (pagado) todavía no está aplicada, esa parte falla
 * y se sigue sin ella: todo "sin fecha" / el pago se calcula.
 */
export async function loadPurchaseExtras(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<{ due: Map<string, string>; paid: Map<string, number> | null }> {
  const due = new Map<string, string>();
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
    for (const d of dues) if (d.due_date) due.set(d.id, d.due_date);
  } catch {
    // sin migración 0056
  }

  let paid: Map<string, number> | null = null;
  try {
    const rows = await fetchAll((from, to) =>
      supabase
        .from("purchases")
        .select("id, paid_amount")
        .eq("org_id", orgId)
        .eq("status", "completada")
        .gt("account_amount", 0)
        .order("id")
        .range(from, to)
    );
    paid = new Map(rows.map((r) => [r.id, Number(r.paid_amount ?? 0)]));
  } catch {
    // sin migración 0058
  }
  return { due, paid };
}

/** Sólo los vencimientos (purchase id -> YYYY-MM-DD). */
export async function loadPurchaseDueDates(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<Map<string, string>> {
  return (await loadPurchaseExtras(supabase, orgId)).due;
}

export async function loadSupplierOverview(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SupplierOverview> {
  const [{ data: suppliersRaw }, purchases] = await Promise.all([
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
  ]);

  const { due: dueByPurchase, paid: paidByPurchase } = await loadPurchaseExtras(supabase, orgId);

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
      paidAmount: paidByPurchase ? (paidByPurchase.get(p.id) ?? 0) : null,
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
  const rows: SupplierRow[] = suppliers.map((s) => ({
    ...s,
    balance: Number(s.balance),
    totalPurchased: totals.get(s.id)?.total ?? 0,
    lastPurchaseAt: totals.get(s.id)?.last ?? null,
    items: itemsBySupplier.get(s.id) ?? [],
  }));

  // Últimos 30 días.
  const since = addDays(todayKey, -30);
  const inLast30 = (iso: string) => daysBetween(since, dayKey(iso)) >= 0;
  const spendBySupplier = new Map<string, number>();
  for (const p of purchases) {
    if (!inLast30(p.created_at)) continue;
    const id = p.supplier_id as string;
    spendBySupplier.set(id, (spendBySupplier.get(id) ?? 0) + Number(p.total));
  }
  const topTotal = Array.from(spendBySupplier.values()).reduce((a, b) => a + b, 0);
  const sorted = Array.from(spendBySupplier.entries()).sort((a, b) => b[1] - a[1]);
  const top: TopSupplier[] = sorted.slice(0, 4).map(([id, amount]) => ({
    name: nameById.get(id) ?? "Proveedor eliminado",
    amount,
    pct: topTotal > 0 ? Math.round((amount / topTotal) * 100) : 0,
  }));

  return { todayKey, rows, top, topTotal };
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
    type Row = {
      id: string;
      supplier_id: string | null;
      account_amount: number | null;
      created_at: string;
      due_date?: string | null;
      paid_amount?: number | null;
    };
    // De lo más completo a lo más básico, según qué migraciones estén aplicadas
    // (0058 pagado, 0056 vencimientos). Sin vencimientos no puede haber vencidas.
    let rows: Row[] | null = null;
    for (const extra of [", due_date, paid_amount", ", due_date"]) {
      try {
        rows = (await fetchAllIn(ids, (chunk, from, to) =>
          supabase
            .from("purchases")
            .select(`${columns}${extra}`)
            .eq("org_id", orgId)
            .eq("status", "completada")
            .gt("account_amount", 0)
            .in("supplier_id", chunk)
            .order("id")
            .range(from, to)
        )) as unknown as Row[];
        break;
      } catch {
        rows = null;
      }
    }
    if (!rows) return 0;

    const purchases: DebtPurchase[] = rows.map((p) => ({
      id: p.id,
      supplierId: p.supplier_id as string,
      accountAmount: Number(p.account_amount),
      createdAt: p.created_at,
      dueDate: p.due_date ?? null,
      paidAmount: p.paid_amount ?? null,
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
