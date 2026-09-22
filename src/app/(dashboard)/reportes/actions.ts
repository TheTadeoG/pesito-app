"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
}

export async function voidSale(saleId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: saleId });

  if (error) {
    return { error: error.message || "No pudimos anular la venta." };
  }

  revalidatePath("/reportes");
  revalidatePath("/inventario");
  revalidatePath("/productos");
  revalidatePath("/pos");
  revalidatePath("/clientes");
  revalidatePath("/caja");

  return {};
}
