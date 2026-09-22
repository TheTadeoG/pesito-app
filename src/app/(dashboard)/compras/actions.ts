"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { computeCashOnHand } from "@/lib/caja";
import type { Json } from "@/lib/database.types";

export interface PurchaseItemInput {
  product_id: string;
  quantity: number;
  unit_cost: number;
}

export type PurchasePaymentMethod =
  | "efectivo"
  | "tarjeta"
  | "transferencia"
  | "qr"
  | "cuenta_corriente";

export interface PurchasePaymentInput {
  method: PurchasePaymentMethod;
  amount: number;
}

export interface RegisterPurchaseInput {
  orgId: string;
  supplierId: string | null;
  notes: string;
  items: PurchaseItemInput[];
  payments: PurchasePaymentInput[];
}

export async function registerPurchase(
  input: RegisterPurchaseInput
): Promise<{ error?: string; purchaseId?: string }> {
  if (input.items.length === 0) {
    return { error: "Agregá al menos un producto a la compra." };
  }

  const { userId } = await requireOrgContext();
  const supabase = await createClient();

  const { data: register } = await supabase
    .from("cash_registers")
    .select("id, opening_amount")
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  const cashAmount = input.payments
    .filter((p) => p.method === "efectivo")
    .reduce((acc, p) => acc + p.amount, 0);

  if (cashAmount > 0) {
    if (!register) {
      return { error: "Abrí tu caja para poder pagar en efectivo." };
    }
    const cashOnHand = await computeCashOnHand(supabase, register.id, Number(register.opening_amount));
    if (cashAmount > cashOnHand) {
      return { error: "No hay suficiente efectivo en la caja para pagar esta parte de la compra." };
    }
  }

  const { data, error } = await supabase.rpc("register_purchase", {
    p_org_id: input.orgId,
    p_supplier_id: input.supplierId,
    p_items: input.items as unknown as Json,
    p_notes: input.notes || null,
    p_cash_register_id: register?.id ?? null,
    p_payments: input.payments as unknown as Json,
  });

  if (error) {
    return { error: error.message || "No pudimos registrar la compra." };
  }

  revalidatePath("/compras");
  revalidatePath("/inventario");
  revalidatePath("/productos");
  revalidatePath("/reportes");
  revalidatePath("/proveedores");
  revalidatePath("/caja");

  return { purchaseId: data ?? undefined };
}

export interface PurchaseDetailItem {
  product_name: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

export interface PurchaseDetail {
  id: string;
  created_at: string;
  subtotal: number;
  total: number;
  notes: string | null;
  status: string;
  supplierName: string;
  accountAmount: number;
  paymentMethod: string | null;
  payments: PurchasePaymentInput[];
  items: PurchaseDetailItem[];
}

export async function getPurchaseDetail(
  purchaseId: string
): Promise<{ error?: string; purchase?: PurchaseDetail }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: purchase } = await supabase
    .from("purchases")
    .select(
      "id, created_at, subtotal, total, notes, status, supplier_id, account_amount, payment_method"
    )
    .eq("id", purchaseId)
    .eq("org_id", organization.id)
    .maybeSingle();

  if (!purchase) return { error: "No encontramos la compra." };

  const [{ data: itemsRaw }, { data: supplierRaw }, { data: paymentsRaw }] = await Promise.all([
    supabase
      .from("purchase_items")
      .select("product_name, quantity, unit_cost, subtotal")
      .eq("purchase_id", purchaseId),
    purchase.supplier_id
      ? supabase.from("suppliers").select("name").eq("id", purchase.supplier_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("purchase_payments").select("method, amount").eq("purchase_id", purchaseId),
  ]);

  return {
    purchase: {
      id: purchase.id,
      created_at: purchase.created_at,
      subtotal: Number(purchase.subtotal),
      total: Number(purchase.total),
      notes: purchase.notes,
      status: purchase.status,
      supplierName: supplierRaw?.name ?? "Sin proveedor",
      accountAmount: Number(purchase.account_amount ?? 0),
      paymentMethod: purchase.payment_method,
      // Compras de antes de esta migración no tienen filas acá: el diálogo
      // cae de vuelta a mostrar sólo el resumen (payment_method/account_amount).
      payments: (paymentsRaw ?? []).map((p) => ({
        method: p.method as PurchasePaymentMethod,
        amount: Number(p.amount),
      })),
      items: (itemsRaw ?? []).map((i) => ({
        product_name: i.product_name,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
        subtotal: Number(i.subtotal),
      })),
    },
  };
}

export async function voidPurchase(purchaseId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_purchase", { p_purchase_id: purchaseId });

  if (error) {
    return { error: error.message || "No pudimos anular la compra." };
  }

  revalidatePath("/compras");
  revalidatePath("/inventario");
  revalidatePath("/productos");
  revalidatePath("/reportes");
  revalidatePath("/proveedores");
  revalidatePath("/caja");

  return {};
}

export async function createSupplierQuick(
  name: string
): Promise<{ error?: string; id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Ingresá un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ org_id: organization.id, name: trimmed })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No pudimos crear el proveedor." };
  }

  revalidatePath("/compras");

  return { id: data.id };
}
