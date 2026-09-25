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
 * las consultas filtradas por RLS volvían vacías).
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
    // Sin este cálculo no hay un efectivo esperado confiable: mejor fallar
    // que cerrar o retirar de una caja con un monto equivocado.
    throw new Error(`No se pudo calcular la caja: ${error?.message ?? "sin datos"}`);
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
 * Como computeCashOnHand, pero devuelve null (y lo loguea) si no se pudo
 * calcular. Para las acciones, que avisan con un error en vez de romper.
 */
export async function tryComputeCashOnHand(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string,
  openingAmount: number
): Promise<number | null> {
  try {
    return await computeCashOnHand(supabase, cashRegisterId, openingAmount);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export const CASH_UNAVAILABLE_ERROR =
  "No pudimos calcular el efectivo de la caja. Probá de nuevo en un rato.";

/**
 * Versión cacheada por request de tryComputeCashOnHand, para lectura (no usar
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
  async (cashRegisterId: string, openingAmount: number): Promise<number | null> => {
    const supabase = await createClient();
    return tryComputeCashOnHand(supabase, cashRegisterId, openingAmount);
  }
);

export interface PaymentBreakdownRow {
  method: string;
  total: number;
}
