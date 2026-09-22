"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { computeCashOnHand, computePaymentBreakdown, type PaymentBreakdownRow } from "@/lib/caja";
import { getFiadoAmountsBySale } from "@/lib/sale-payments";
import { getMemberLabelsById, memberLabelFor } from "@/lib/member-labels";
import type { SaleRow } from "@/components/dashboard/ventas-list";

export interface ActionState {
  error?: string;
}

export interface CajaMovementRow {
  id: string;
  type: "ingreso" | "retiro";
  amount: number;
  reason: string | null;
  created_at: string;
}

export interface CajaDetail {
  id: string;
  status: string;
  userLabel: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  expectedAmount: number;
  closingAmount: number | null;
  efectivoSalesTotal: number;
  ingresosTotal: number;
  retirosTotal: number;
  paymentBreakdown: PaymentBreakdownRow[];
  movements: CajaMovementRow[];
  saleRows: SaleRow[];
}

export async function getCajaDetail(
  cashRegisterId: string
): Promise<{ error?: string; detail?: CajaDetail }> {
  const { organization, userId } = await requireOrgContext();
  const supabase = await createClient();

  const { data: register } = await supabase
    .from("cash_registers")
    .select(
      "id, user_id, opening_amount, opened_at, closed_at, closing_amount, expected_amount, status"
    )
    .eq("id", cashRegisterId)
    .eq("org_id", organization.id)
    .maybeSingle();

  if (!register) return { error: "No encontramos la caja." };

  const memberLabelsById = await getMemberLabelsById(supabase, organization.id);
  const openingAmount = Number(register.opening_amount);

  const [{ data: movementsRaw }, { data: salesRaw }, expectedAmount, paymentBreakdown] =
    await Promise.all([
      supabase
        .from("cash_movements")
        .select("id, type, amount, reason, created_at")
        .eq("cash_register_id", cashRegisterId)
        .order("created_at"),
      supabase
        .from("sales")
        .select("id, total, payment_method, invoice_type, created_at, customer_id, status")
        .eq("cash_register_id", cashRegisterId)
        .order("created_at", { ascending: false }),
      computeCashOnHand(supabase, cashRegisterId, openingAmount),
      computePaymentBreakdown(supabase, cashRegisterId),
    ]);

  const movements: CajaMovementRow[] = (movementsRaw ?? []).map((m) => ({
    id: m.id,
    type: m.type,
    amount: Number(m.amount),
    reason: m.reason,
    created_at: m.created_at,
  }));
  const ingresosTotal = movements
    .filter((m) => m.type === "ingreso")
    .reduce((acc, m) => acc + m.amount, 0);
  const retirosTotal = movements
    .filter((m) => m.type === "retiro")
    .reduce((acc, m) => acc + m.amount, 0);

  const sales = (salesRaw ?? [])
    .filter((s) => s.status === "completada")
    .map((s) => ({ ...s, total: Number(s.total) }));
  const efectivoSalesTotal = sales
    .filter((s) => s.payment_method === "efectivo")
    .reduce((acc, s) => acc + s.total, 0);

  const saleIds = sales.map((s) => s.id);
  const [{ data: itemsRaw }, { data: customersRaw }, fiadoBySale] = await Promise.all([
    saleIds.length > 0
      ? supabase
          .from("sale_items")
          .select("sale_id, product_name, quantity")
          .in("sale_id", saleIds)
      : Promise.resolve({ data: [] }),
    (() => {
      const customerIds = Array.from(
        new Set(sales.map((s) => s.customer_id).filter((id): id is string => Boolean(id)))
      );
      return customerIds.length > 0
        ? supabase.from("customers").select("id, name").in("id", customerIds)
        : Promise.resolve({ data: [] });
    })(),
    getFiadoAmountsBySale(supabase, saleIds),
  ]);

  const customerNameById = new Map((customersRaw ?? []).map((c) => [c.id, c.name]));
  const itemsBySale = new Map<string, string[]>();
  for (const item of itemsRaw ?? []) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    const quantity = Number(item.quantity);
    list.push(quantity > 1 ? `${item.product_name} x${quantity}` : item.product_name);
    itemsBySale.set(item.sale_id, list);
  }

  const saleRows: SaleRow[] = sales.map((sale) => ({
    id: sale.id,
    created_at: sale.created_at,
    total: sale.total,
    payment_method: sale.payment_method,
    invoice_type: sale.invoice_type,
    customerName: sale.customer_id
      ? customerNameById.get(sale.customer_id) ?? "Cliente eliminado"
      : "Consumidor Final",
    itemsSummary: (itemsBySale.get(sale.id) ?? []).join(", ") || "Sin detalle",
    fiadoAmount: fiadoBySale.get(sale.id) ?? 0,
  }));

  return {
    detail: {
      id: register.id,
      status: register.status,
      userLabel: memberLabelFor(register.user_id, userId, memberLabelsById),
      openedAt: register.opened_at,
      closedAt: register.closed_at,
      openingAmount,
      expectedAmount: register.status === "cerrada" ? Number(register.expected_amount ?? 0) : expectedAmount,
      closingAmount: register.closing_amount === null ? null : Number(register.closing_amount),
      efectivoSalesTotal,
      ingresosTotal,
      retirosTotal,
      paymentBreakdown,
      movements,
      saleRows,
    },
  };
}

export async function openCaja(openingAmount: number): Promise<ActionState> {
  if (openingAmount < 0) return { error: "El monto inicial no puede ser negativo." };

  const { organization, userId } = await requireOrgContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("org_id", organization.id)
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (existing) {
    return { error: "Ya tenés una caja abierta." };
  }

  const { error } = await supabase.from("cash_registers").insert({
    org_id: organization.id,
    user_id: userId,
    opening_amount: openingAmount,
    status: "abierta",
  });

  if (error) return { error: "No pudimos abrir la caja." };

  revalidatePath("/caja");
  revalidatePath("/pos");
  return {};
}

export async function addCashMovement(
  cashRegisterId: string,
  type: "ingreso" | "retiro",
  amount: number,
  reason: string
): Promise<ActionState> {
  if (!amount || amount <= 0) return { error: "Ingresá un monto válido." };

  const { organization, userId } = await requireOrgContext();
  const supabase = await createClient();

  if (type === "retiro") {
    const { data: register } = await supabase
      .from("cash_registers")
      .select("opening_amount")
      .eq("id", cashRegisterId)
      .single();

    if (register) {
      const cashOnHand = await computeCashOnHand(
        supabase,
        cashRegisterId,
        Number(register.opening_amount)
      );
      if (amount > cashOnHand) {
        return { error: "No podés retirar más efectivo del que hay disponible." };
      }
    }
  }

  const { error } = await supabase.from("cash_movements").insert({
    org_id: organization.id,
    cash_register_id: cashRegisterId,
    type,
    amount,
    reason: reason.trim() || null,
    user_id: userId,
  });

  if (error) return { error: "No pudimos registrar el movimiento." };

  revalidatePath("/caja");
  revalidatePath("/pos");
  return {};
}

export async function closeCaja(
  cashRegisterId: string,
  countedAmount: number
): Promise<ActionState> {
  const supabase = await createClient();

  const { data: register } = await supabase
    .from("cash_registers")
    .select("opening_amount")
    .eq("id", cashRegisterId)
    .single();

  if (!register) return { error: "No encontramos la caja." };

  const expectedAmount = await computeCashOnHand(
    supabase,
    cashRegisterId,
    Number(register.opening_amount)
  );

  const { error } = await supabase
    .from("cash_registers")
    .update({
      status: "cerrada",
      closing_amount: countedAmount,
      expected_amount: expectedAmount,
      closed_at: new Date().toISOString(),
    })
    .eq("id", cashRegisterId);

  if (error) return { error: "No pudimos cerrar la caja." };

  revalidatePath("/caja");
  revalidatePath("/pos");
  revalidatePath("/reportes");
  return {};
}
