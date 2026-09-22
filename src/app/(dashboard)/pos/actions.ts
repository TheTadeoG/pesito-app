"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import type { Json } from "@/lib/database.types";

export interface CheckoutItemInput {
  product_id: string | null;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

export interface CheckoutInput {
  orgId: string;
  cashRegisterId: string;
  customerId: string | null;
  paymentMethod: "efectivo" | "tarjeta" | "transferencia" | "qr" | "mixto" | "fiado";
  discount: number;
  surcharge: number;
  invoiceType: "consumidor_final" | "factura_a" | "factura_b" | "factura_c";
  items: CheckoutItemInput[];
}

export async function checkoutSale(
  input: CheckoutInput
): Promise<{ error?: string; saleId?: string }> {
  if (input.items.length === 0) {
    return { error: "El carrito está vacío." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkout_sale", {
    p_org_id: input.orgId,
    p_cash_register_id: input.cashRegisterId,
    p_customer_id: input.customerId,
    p_payment_method: input.paymentMethod,
    p_discount: input.discount,
    p_items: input.items as unknown as Json,
    p_surcharge: input.surcharge,
    p_invoice_type: input.invoiceType,
  });

  if (error) {
    return { error: error.message || "No pudimos procesar la venta." };
  }

  revalidatePath("/pos");
  revalidatePath("/inventario");
  revalidatePath("/productos");
  revalidatePath("/caja");
  revalidatePath("/reportes");

  return { saleId: data ?? undefined };
}

export async function createCustomerQuick(
  name: string
): Promise<{ error?: string; id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Ingresá un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({ org_id: organization.id, name: trimmed })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No pudimos crear el cliente." };
  }

  revalidatePath("/pos");
  revalidatePath("/clientes");

  return { id: data.id };
}
