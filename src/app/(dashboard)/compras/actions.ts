"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import type { Json } from "@/lib/database.types";

export interface PurchaseItemInput {
  product_id: string;
  quantity: number;
  unit_cost: number;
}

export interface RegisterPurchaseInput {
  orgId: string;
  supplierId: string | null;
  notes: string;
  items: PurchaseItemInput[];
}

export async function registerPurchase(
  input: RegisterPurchaseInput
): Promise<{ error?: string; purchaseId?: string }> {
  if (input.items.length === 0) {
    return { error: "Agregá al menos un producto a la compra." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_purchase", {
    p_org_id: input.orgId,
    p_supplier_id: input.supplierId,
    p_items: input.items as unknown as Json,
    p_notes: input.notes || null,
  });

  if (error) {
    return { error: error.message || "No pudimos registrar la compra." };
  }

  revalidatePath("/compras");
  revalidatePath("/inventario");
  revalidatePath("/productos");
  revalidatePath("/reportes");

  return { purchaseId: data ?? undefined };
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
