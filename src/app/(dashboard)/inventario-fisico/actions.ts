"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getBranchContext } from "@/lib/branches";

export interface InventoryActionResult {
  error?: string;
  id?: string;
  /** Lo que el sistema decía al contar (para mostrar la diferencia). */
  expected?: number | null;
  adjusted?: number;
  unitsPlus?: number;
  unitsMinus?: number;
}

// Los mensajes de las funciones de la base ya están en castellano y pensados para mostrarse.
function message(e: { message: string } | null, fallback: string): string {
  return e && /^(Sólo|Necesitás|Ya hay|Poné|Este inventario|Inventario no|Producto no|Sucursal no|La cantidad)/.test(e.message) ? e.message : fallback;
}

export async function startInventory(name: string, brand: string | null, supplierId: string | null): Promise<InventoryActionResult> {
  const { organization } = await requireOrgContext();
  const { current: branch } = await getBranchContext();
  if (!branch) return { error: "No encontramos la sucursal. Probá de nuevo." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventory_start", {
    p_org_id: organization.id,
    p_branch_id: branch.id,
    p_name: name,
    p_brand: brand,
    p_supplier_id: supplierId,
  });
  if (error || !data) return { error: message(error, "No pudimos empezar el inventario. Probá de nuevo.") };
  revalidatePath("/inventario-fisico");
  return { id: data };
}

export async function setInventoryCount(countId: string, productId: string, counted: number | null): Promise<InventoryActionResult> {
  await requireOrgContext();
  if (counted !== null && (!Number.isFinite(counted) || counted < 0)) return { error: "La cantidad no puede ser negativa." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventory_set_count", { p_count_id: countId, p_product_id: productId, p_counted: counted });
  if (error) return { error: message(error, "No pudimos guardar lo contado. Probá de nuevo.") };
  return { expected: data === null ? null : Number(data) };
}

export async function applyInventory(countId: string): Promise<InventoryActionResult> {
  await requireOrgContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventory_apply", { p_count_id: countId });
  if (error || !data) return { error: message(error, "No pudimos aplicar el inventario. Probá de nuevo.") };
  const r = data as { adjusted?: number; units_plus?: number; units_minus?: number };
  revalidatePath("/inventario-fisico");
  revalidatePath("/productos");
  return { adjusted: Number(r.adjusted ?? 0), unitsPlus: Number(r.units_plus ?? 0), unitsMinus: Number(r.units_minus ?? 0) };
}

export async function cancelInventory(countId: string): Promise<InventoryActionResult> {
  await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("inventory_cancel", { p_count_id: countId });
  if (error) return { error: message(error, "No pudimos cancelar el inventario. Probá de nuevo.") };
  revalidatePath("/inventario-fisico");
  return {};
}
