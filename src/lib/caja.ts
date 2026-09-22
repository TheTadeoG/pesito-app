import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function computeCashOnHand(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string,
  openingAmount: number
): Promise<number> {
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

  const movementsNet = (movements ?? []).reduce(
    (acc, m) => acc + (m.type === "ingreso" ? Number(m.amount) : -Number(m.amount)),
    0
  );
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

  return (
    openingAmount +
    salesTotal +
    mixedCashTotal +
    debtPaymentsTotal -
    supplierPaymentsTotal -
    cashPurchasesTotal +
    movementsNet
  );
}

export interface PaymentBreakdownRow {
  method: string;
  total: number;
}

export async function computePaymentBreakdown(
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
