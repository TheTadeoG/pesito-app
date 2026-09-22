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
    unit: string;
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
    active: input.active,
    image_url: input.imageUrl,
    default_supplier_id: input.defaultSupplierId,
  };

  if (input.id) {
    const { error } = await supabase.from("products").update(payload).eq("id", input.id);
    if (error) return { error: "No pudimos guardar los cambios." };

    revalidatePath("/productos");
    revalidatePath("/inventario");
    revalidatePath("/pos");
    return {};
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...payload, stock: input.stock })
    .select("id, name, barcode, sku, cost, stock, unit")
    .single();

  if (error || !data) return { error: "No pudimos crear el producto." };

  revalidatePath("/productos");
  revalidatePath("/inventario");
  revalidatePath("/pos");
  revalidatePath("/compras");

  return {
    product: {
      ...data,
      cost: data.cost === null ? null : Number(data.cost),
      stock: Number(data.stock),
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

export async function toggleProductActive(id: string, active: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ active }).eq("id", id);
  if (error) return { error: "No pudimos actualizar el producto." };

  revalidatePath("/productos");
  revalidatePath("/inventario");
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
  revalidatePath("/inventario");
  revalidatePath("/pos");
  return {};
}
