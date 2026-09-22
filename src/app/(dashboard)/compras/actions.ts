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
  supplierName: string;
  items: PurchaseDetailItem[];
}

export async function getPurchaseDetail(
  purchaseId: string
): Promise<{ error?: string; purchase?: PurchaseDetail }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, created_at, subtotal, total, notes, supplier_id")
    .eq("id", purchaseId)
    .eq("org_id", organization.id)
    .maybeSingle();

  if (!purchase) return { error: "No encontramos la compra." };

  const [{ data: itemsRaw }, { data: supplierRaw }] = await Promise.all([
    supabase
      .from("purchase_items")
      .select("product_name, quantity, unit_cost, subtotal")
      .eq("purchase_id", purchaseId),
    purchase.supplier_id
      ? supabase.from("suppliers").select("name").eq("id", purchase.supplier_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    purchase: {
      id: purchase.id,
      created_at: purchase.created_at,
      subtotal: Number(purchase.subtotal),
      total: Number(purchase.total),
      notes: purchase.notes,
      supplierName: supplierRaw?.name ?? "Sin proveedor",
      items: (itemsRaw ?? []).map((i) => ({
        product_name: i.product_name,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
        subtotal: Number(i.subtotal),
      })),
    },
  };
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
