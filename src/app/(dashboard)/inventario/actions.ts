"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";

export interface ActionState {
  error?: string;
}

export async function adjustStock(
  productId: string,
  delta: number,
  reason: string
): Promise<ActionState> {
  if (!delta) return { error: "Ingresá una cantidad distinta de cero." };

  const { organization, userId } = await requireOrgContext();
  const supabase = await createClient();

  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, stock")
    .eq("id", productId)
    .eq("org_id", organization.id)
    .single();

  if (fetchError || !product) {
    return { error: "No encontramos el producto." };
  }

  const newStock = Number(product.stock) + delta;
  if (newStock < 0) {
    return { error: "El ajuste dejaría el stock en negativo." };
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", productId);

  if (updateError) {
    return { error: "No pudimos actualizar el stock." };
  }

  await supabase.from("stock_movements").insert({
    org_id: organization.id,
    product_id: productId,
    type: "ajuste",
    quantity: delta,
    reference: reason || null,
    user_id: userId,
  });

  revalidatePath("/inventario");
  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}
