"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
  paymentMethod: "efectivo" | "tarjeta" | "transferencia" | "mixto" | "fiado";
  discount: number;
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
