"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getBranchContext } from "@/lib/branches";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import { getMemberLabelsById } from "@/lib/member-labels";
import { isOrgAdmin } from "@/lib/roles";

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

export interface InventoryDetail {
  error?: string;
  name?: string;
  status?: string;
  branch?: string | null;
  scope?: string;
  createdAt?: string;
  createdBy?: string | null;
  appliedAt?: string | null;
  appliedBy?: string | null;
  adjusted?: number;
  plus?: number;
  minus?: number;
  items?: { productId: string; name: string; sku: string; unit: string; expected: number; counted: number }[];
}

// Detalle de un inventario: qué se contó de cada producto, contra lo que decía el sistema en ese momento.
export async function getInventoryDetail(countId: string): Promise<InventoryDetail> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador pueden ver los inventarios." };
  const supabase = await createClient();
  const { data: count } = await supabase
    .from("inventory_counts")
    .select("id, name, status, branch_id, scope_brand, scope_supplier_id, created_at, created_by, applied_at, applied_by, adjusted_count, units_plus, units_minus")
    .eq("id", countId)
    .eq("org_id", organization.id)
    .maybeSingle();
  if (!count) return { error: "No encontramos el inventario." };

  const [rows, labels, branchRes, supplierRes] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("inventory_count_items").select("id, product_id, counted, expected").eq("count_id", countId).order("id").range(from, to)
    ),
    getMemberLabelsById(supabase, organization.id),
    supabase.from("branches").select("name").eq("id", count.branch_id).maybeSingle(),
    count.scope_supplier_id ? supabase.from("suppliers").select("name").eq("id", count.scope_supplier_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const products = new Map(
    (
      await fetchAllIn(
        rows.map((r) => r.product_id),
        (ids, from, to) => supabase.from("products").select("id, name, sku, unit").in("id", ids).order("id").range(from, to)
      )
    ).map((p) => [p.id, p])
  );
  const who = (id: string | null) => (id ? labels.get(id) ?? "Usuario eliminado" : null);
  return {
    name: count.name,
    status: count.status,
    branch: branchRes.data?.name ?? null,
    scope: count.scope_brand ? `Marca: ${count.scope_brand}` : supplierRes.data?.name ? `Proveedor: ${supplierRes.data.name}` : "Todos los productos",
    createdAt: count.created_at,
    createdBy: who(count.created_by),
    appliedAt: count.applied_at,
    appliedBy: who(count.applied_by),
    adjusted: count.adjusted_count ?? 0,
    plus: Number(count.units_plus ?? 0),
    minus: Number(count.units_minus ?? 0),
    items: rows
      .map((r) => {
        const p = products.get(r.product_id);
        return { productId: r.product_id, name: p?.name ?? "Producto eliminado", sku: p?.sku ?? "", unit: p?.unit ?? "u", expected: Number(r.expected), counted: Number(r.counted) };
      })
      .sort((a, b) => Math.abs(b.counted - b.expected) - Math.abs(a.counted - a.expected) || a.name.localeCompare(b.name)),
  };
}
