"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";

export interface ProductFormInput {
  id?: string;
  name: string;
  brand: string;
  barcode: string;
  sku: string;
  price: number;
  cost: number | null;
  stock: number;
  minStock: number;
  unit: string;
  packageLabel: string;
  active: boolean;
  imageUrl: string | null;
  defaultSupplierId: string | null;
}

export interface ActionState {
  error?: string;
}

export interface SaveProductResult extends ActionState {
  product?: {
    id: string;
    name: string;
    barcode: string | null;
    sku: string | null;
    cost: number | null;
    stock: number;
    min_stock: number;
    unit: string;
    image_url: string | null;
  };
}

export async function saveProduct(input: ProductFormInput): Promise<SaveProductResult> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  if (!input.name.trim()) {
    return { error: "El producto necesita un nombre." };
  }

  const payload = {
    org_id: organization.id,
    name: input.name.trim(),
    brand: input.brand.trim() || null,
    barcode: input.barcode.trim() || null,
    sku: input.sku.trim() || null,
    price: input.price,
    cost: input.cost,
    min_stock: input.minStock,
    unit: input.unit,
    package_label: input.packageLabel.trim() || null,
    active: input.active,
    image_url: input.imageUrl,
    default_supplier_id: input.defaultSupplierId,
  };

  if (input.id) {
    const { error } = await supabase.from("products").update(payload).eq("id", input.id);
    if (error) return { error: "No pudimos guardar los cambios." };

    revalidatePath("/productos");
    revalidatePath("/pos");
    return {};
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...payload, stock: input.stock })
    .select("id, name, barcode, sku, cost, stock, min_stock, unit, image_url")
    .single();

  if (error || !data) return { error: "No pudimos crear el producto." };

  revalidatePath("/productos");
  revalidatePath("/pos");
  revalidatePath("/compras");

  return {
    product: {
      ...data,
      cost: data.cost === null ? null : Number(data.cost),
      stock: Number(data.stock),
      min_stock: Number(data.min_stock),
    },
  };
}

export async function createBrandQuick(name: string): Promise<{ error?: string; id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Ingresá un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .insert({ org_id: organization.id, name: trimmed })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No pudimos crear la marca." };
  }

  revalidatePath("/productos");

  return { id: data.id };
}

export async function createSupplierQuick(name: string): Promise<{ error?: string; id?: string }> {
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

  revalidatePath("/productos");
  revalidatePath("/compras");
  revalidatePath("/proveedores");

  return { id: data.id };
}

export async function toggleProductActive(id: string, active: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ active }).eq("id", id);
  if (error) return { error: "No pudimos actualizar el producto." };

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}

export async function deleteProduct(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    return {
      error:
        "No pudimos borrar el producto (puede tener ventas asociadas). Podés desactivarlo en su lugar.",
    };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
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

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}

export async function saveBrand(id: string | undefined, name: string): Promise<ActionState> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "La marca necesita un nombre." };

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  if (id) {
    const { data: existing } = await supabase
      .from("brands")
      .select("name")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("brands")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) return { error: "No pudimos guardar los cambios." };

    // products.brand guarda el nombre (no un id): renombrar la marca acá
    // debe reflejarse en los productos que ya la tenían asignada.
    if (existing && existing.name !== trimmed) {
      await supabase
        .from("products")
        .update({ brand: trimmed })
        .eq("org_id", organization.id)
        .eq("brand", existing.name);
    }
  } else {
    const { error } = await supabase
      .from("brands")
      .insert({ org_id: organization.id, name: trimmed });
    if (error) return { error: "No pudimos crear la marca." };
  }

  revalidatePath("/productos");
  return {};
}

export async function deleteBrand(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) return { error: "No pudimos borrar la marca." };

  revalidatePath("/productos");
  return {};
}

export interface BulkPriceIncreaseResult extends ActionState {
  updatedCount?: number;
}

export async function bulkIncreasePriceBySupplier(
  supplierId: string,
  mode: "percent" | "fixed",
  value: number
): Promise<BulkPriceIncreaseResult> {
  if (!supplierId) return { error: "Elegí un proveedor." };
  if (!value || value <= 0) return { error: "Ingresá un valor mayor a cero." };

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("bulk_increase_price_by_supplier", {
    p_org_id: organization.id,
    p_supplier_id: supplierId,
    p_percent: mode === "percent" ? value : null,
    p_fixed_amount: mode === "fixed" ? value : null,
  });

  if (error) return { error: "No pudimos actualizar los precios." };

  revalidatePath("/productos");
  revalidatePath("/pos");
  return { updatedCount: data ?? 0 };
}

export interface PriceHistoryRow {
  id: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  changedByLabel: string | null;
}

export async function getProductPriceHistory(productId: string): Promise<PriceHistoryRow[]> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("product_price_history")
    .select("id, old_price, new_price, changed_by, created_at")
    .eq("org_id", organization.id)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  const userIds = Array.from(
    new Set(rows.map((r) => r.changed_by).filter((id): id is string => Boolean(id)))
  );

  const membersByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from("memberships")
      .select("user_id, username, email")
      .eq("org_id", organization.id)
      .in("user_id", userIds);
    for (const m of members ?? []) {
      membersByUserId.set(m.user_id, m.username ?? m.email ?? "Alguien del equipo");
    }
  }

  return rows.map((r) => ({
    id: r.id,
    oldPrice: Number(r.old_price),
    newPrice: Number(r.new_price),
    changedAt: r.created_at,
    changedByLabel: r.changed_by ? membersByUserId.get(r.changed_by) ?? null : null,
  }));
}

export async function revertProductPrice(productId: string, price: number): Promise<ActionState> {
  if (!Number.isFinite(price) || price < 0) return { error: "Precio inválido." };

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ price })
    .eq("id", productId)
    .eq("org_id", organization.id);

  if (error) return { error: "No pudimos volver a ese precio." };

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}
