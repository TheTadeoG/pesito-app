import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export interface CashBreakdown {
  openingAmount: number;
  // Ventas en efectivo, incluida la parte efectivo de ventas "mixto".
  salesCashTotal: number;
  // Cobros de deuda de fiado (desde Clientes) en efectivo.
  debtPaymentsTotal: number;
  ingresosTotal: number;
  retirosTotal: number;
  // Pagos a proveedores (cuenta corriente) en efectivo.
  supplierPaymentsTotal: number;
  // Compras pagadas en efectivo en el momento.
  cashPurchasesTotal: number;
}

export function sumCashBreakdown(b: CashBreakdown): number {
  return (
    b.openingAmount +
    b.salesCashTotal +
    b.debtPaymentsTotal +
    b.ingresosTotal -
    b.retirosTotal -
    b.supplierPaymentsTotal -
    b.cashPurchasesTotal
  );
}

export interface CashRegisterSummary {
  cash: CashBreakdown;
  payments: PaymentBreakdownRow[];
}

function emptySummary(openingAmount: number): CashRegisterSummary {
  return {
    cash: {
      openingAmount,
      salesCashTotal: 0,
      debtPaymentsTotal: 0,
      ingresosTotal: 0,
      retirosTotal: 0,
      supplierPaymentsTotal: 0,
      cashPurchasesTotal: 0,
    },
    payments: [],
  };
}

/**
 * Efectivo y desglose por medio de pago de varias cajas con una sola
 * consulta (función SQL cash_register_summaries, migración 0038). Antes se
 * hacían 3 a 8 consultas por caja y la página de Caja llegaba a ~194.
 *
 * Una caja que el usuario no puede ver vuelve en cero (igual que antes, que
 * las consultas filtradas por RLS volvían vacías). Si la función todavía no
 * existe en la base (código desplegado antes que la migración) o falla, se
 * calcula como antes, caja por caja.
 */
export async function getCashRegisterSummaries(
  supabase: SupabaseClient<Database>,
  registers: readonly { id: string; openingAmount: number }[]
): Promise<Map<string, CashRegisterSummary>> {
  const result = new Map<string, CashRegisterSummary>();
  const openingById = new Map(registers.map((r) => [r.id, r.openingAmount]));
  if (openingById.size === 0) return result;

  const { data, error } = await supabase.rpc("cash_register_summaries", {
    p_register_ids: Array.from(openingById.keys()),
  });

  if (error || !data) {
    console.error("cash_register_summaries falló, se calcula caja por caja:", error?.message);
    await Promise.all(
      Array.from(openingById.entries()).map(async ([id, openingAmount]) => {
        const [cash, payments] = await Promise.all([
          legacyCashBreakdown(supabase, id, openingAmount),
          legacyPaymentBreakdown(supabase, id),
        ]);
        result.set(id, { cash, payments });
      })
    );
    return result;
  }

  for (const [id, openingAmount] of openingById) {
    result.set(id, emptySummary(openingAmount));
  }
  for (const row of data) {
    const openingAmount = openingById.get(row.cash_register_id);
    if (openingAmount === undefined) continue;
    const payments = (Array.isArray(row.payment_breakdown) ? row.payment_breakdown : []) as {
      method: string;
      total: number | string;
    }[];
    result.set(row.cash_register_id, {
      cash: {
        openingAmount,
        salesCashTotal: Number(row.sales_cash),
        debtPaymentsTotal: Number(row.debt_payments),
        ingresosTotal: Number(row.ingresos),
        retirosTotal: Number(row.retiros),
        supplierPaymentsTotal: Number(row.supplier_payments),
        cashPurchasesTotal: Number(row.cash_purchases),
      },
      payments: payments
        .map((p) => ({ method: p.method, total: Number(p.total) }))
        .sort((a, b) => b.total - a.total),
    });
  }
  return result;
}

export async function getCashRegisterSummary(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string,
  openingAmount: number
): Promise<CashRegisterSummary> {
  const summaries = await getCashRegisterSummaries(supabase, [
    { id: cashRegisterId, openingAmount },
  ]);
  return summaries.get(cashRegisterId) ?? emptySummary(openingAmount);
}

export async function computeCashBreakdown(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string,
  openingAmount: number
): Promise<CashBreakdown> {
  return (await getCashRegisterSummary(supabase, cashRegisterId, openingAmount)).cash;
}

export async function computeCashOnHand(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string,
  openingAmount: number
): Promise<number> {
  const breakdown = await computeCashBreakdown(supabase, cashRegisterId, openingAmount);
  return sumCashBreakdown(breakdown);
}

/**
 * Versión cacheada por request de computeCashOnHand, para lectura (no usar
 * en acciones que necesitan el valor recién escrito). La clave del caché es
 * la caja registradora en sí (cashRegisterId), no el usuario ni el negocio
 * — sigue siendo correcta si en el futuro varios vendedores comparten una
 * misma caja o hay varias sucursales, cada una con sus propias cajas.
 *
 * El layout del dashboard calcula el efectivo en caja en cada navegación;
 * con esto, si algo más lo pide para la misma caja en el mismo request, no
 * se vuelve a consultar.
 */
export const getCachedCashOnHand = cache(
  async (cashRegisterId: string, openingAmount: number): Promise<number> => {
    const supabase = await createClient();
    return computeCashOnHand(supabase, cashRegisterId, openingAmount);
  }
);

export interface PaymentBreakdownRow {
  method: string;
  total: number;
}

// Cálculo anterior, caja por caja. Sólo se usa si falla
// cash_register_summaries (por ejemplo, si la migración 0038 todavía no se
// aplicó). Se puede borrar una vez aplicada en producción.
async function legacyCashBreakdown(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string,
  openingAmount: number
): Promise<CashBreakdown> {
  const [
    { data: sales },
    { data: mixedSales },
    { data: movements },
    { data: debtPayments },
    { data: supplierPayments },
    { data: cashRegisterPurchases },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("total")
      .eq("cash_register_id", cashRegisterId)
      .eq("payment_method", "efectivo")
      .eq("status", "completada"),
    supabase
      .from("sales")
      .select("id, total")
      .eq("cash_register_id", cashRegisterId)
      .eq("payment_method", "mixto")
      .eq("status", "completada"),
    supabase
      .from("cash_movements")
      .select("type, amount")
      .eq("cash_register_id", cashRegisterId),
    // Cobros de deuda de fiado (desde Clientes) en efectivo también suman.
    supabase
      .from("customer_payments")
      .select("amount")
      .eq("cash_register_id", cashRegisterId)
      .eq("method", "efectivo"),
    // Pagos a proveedores (cuenta corriente) en efectivo restan.
    supabase
      .from("supplier_payments")
      .select("amount")
      .eq("cash_register_id", cashRegisterId)
      .eq("method", "efectivo"),
    // Compras de esta caja (para ver, abajo, cuánto de eso fue en efectivo).
    // Una compra puede combinar medios, así que no alcanza con mirar
    // purchases.payment_method: hay que ir al desglose de purchase_payments.
    supabase
      .from("purchases")
      .select("id")
      .eq("cash_register_id", cashRegisterId)
      .eq("status", "completada"),
  ]);

  const salesTotal = (sales ?? []).reduce((acc, sale) => acc + Number(sale.total), 0);

  // Ventas "mixto" (combinan medios de pago): sólo cuenta la parte en
  // efectivo, guardada en sale_payments. Una venta "mixto" de antes de esta
  // migración no tiene filas ahí y no aporta nada acá (no sabemos cuánto de
  // esa venta vieja fue efectivo).
  const mixedIds = (mixedSales ?? []).map((s) => s.id);
  let mixedCashTotal = 0;
  if (mixedIds.length > 0) {
    const { data: mixedCash } = await supabase
      .from("sale_payments")
      .select("amount")
      .in("sale_id", mixedIds)
      .eq("method", "efectivo");
    mixedCashTotal = (mixedCash ?? []).reduce((acc, p) => acc + Number(p.amount), 0);
  }

  const ingresosTotal = (movements ?? [])
    .filter((m) => m.type === "ingreso")
    .reduce((acc, m) => acc + Number(m.amount), 0);
  const retirosTotal = (movements ?? [])
    .filter((m) => m.type === "retiro")
    .reduce((acc, m) => acc + Number(m.amount), 0);
  const debtPaymentsTotal = (debtPayments ?? []).reduce((acc, p) => acc + Number(p.amount), 0);
  const supplierPaymentsTotal = (supplierPayments ?? []).reduce(
    (acc, p) => acc + Number(p.amount),
    0
  );

  const purchaseIds = (cashRegisterPurchases ?? []).map((p) => p.id);
  let cashPurchasesTotal = 0;
  if (purchaseIds.length > 0) {
    const { data: cashPurchasePayments } = await supabase
      .from("purchase_payments")
      .select("amount")
      .in("purchase_id", purchaseIds)
      .eq("method", "efectivo");
    cashPurchasesTotal = (cashPurchasePayments ?? []).reduce(
      (acc, p) => acc + Number(p.amount),
      0
    );
  }

  return {
    openingAmount,
    salesCashTotal: salesTotal + mixedCashTotal,
    debtPaymentsTotal,
    ingresosTotal,
    retirosTotal,
    supplierPaymentsTotal,
    cashPurchasesTotal,
  };
}


async function legacyPaymentBreakdown(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string
): Promise<PaymentBreakdownRow[]> {
  const [{ data: sales }, { data: debtPayments }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, payment_method, total")
      .eq("cash_register_id", cashRegisterId)
      .eq("status", "completada"),
    supabase
      .from("customer_payments")
      .select("method, amount")
      .eq("cash_register_id", cashRegisterId),
  ]);

  const mixedSales = (sales ?? []).filter((s) => s.payment_method === "mixto");
  const mixedIds = mixedSales.map((s) => s.id);

  const mixedPayments =
    mixedIds.length > 0
      ? (
          await supabase
            .from("sale_payments")
            .select("sale_id, method, amount")
            .in("sale_id", mixedIds)
        ).data ?? []
      : [];

  const mixedIdsWithPayments = new Set(mixedPayments.map((p) => p.sale_id));

  const totals = new Map<string, number>();
  for (const sale of sales ?? []) {
    if (sale.payment_method === "mixto") {
      // Sin desglose guardado (venta de antes de esta migración): seguimos
      // mostrándola agrupada bajo "mixto" para no perder el monto.
      if (!mixedIdsWithPayments.has(sale.id)) {
        totals.set("mixto", (totals.get("mixto") ?? 0) + Number(sale.total));
      }
      continue;
    }
    totals.set(sale.payment_method, (totals.get(sale.payment_method) ?? 0) + Number(sale.total));
  }
  for (const payment of mixedPayments) {
    totals.set(payment.method, (totals.get(payment.method) ?? 0) + Number(payment.amount));
  }
  for (const payment of debtPayments ?? []) {
    totals.set(payment.method, (totals.get(payment.method) ?? 0) + Number(payment.amount));
  }

  return Array.from(totals.entries())
    .map(([method, total]) => ({ method, total }))
    .sort((a, b) => b.total - a.total);
}
