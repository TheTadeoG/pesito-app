"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { formatCurrency } from "@/lib/utils";

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
    price: number;
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

  if (input.stock < 0) {
    return { error: "El stock inicial no puede ser negativo." };
  }

  if (input.minStock < 0) {
    return { error: "El stock mínimo no puede ser negativo." };
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
    .select("id, name, barcode, sku, cost, price, stock, min_stock, unit, image_url")
    .single();

  if (error || !data) return { error: "No pudimos crear el producto." };

  revalidatePath("/productos");
  revalidatePath("/pos");
  revalidatePath("/compras");

  return {
    product: {
      ...data,
      cost: data.cost === null ? null : Number(data.cost),
      price: Number(data.price),
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
  // Sólo con alsoPrice: cuántos precios de venta subieron junto al costo.
  priceUpdatedCount?: number;
}

// Agrupa por proveedor por defecto o por marca (uno de los dos) — usado
// tanto para "Aumentar precios" como para "Aumentar costos".
export async function bulkIncreaseField(
  field: "price" | "cost",
  groupBy: { supplierId: string } | { brand: string },
  mode: "percent" | "fixed",
  value: number,
  // Sólo para costos: sube también el precio de venta en la misma
  // proporción que el costo de cada producto (migración 0040).
  alsoPrice = false
): Promise<BulkPriceIncreaseResult> {
  if (!value || value <= 0) return { error: "Ingresá un valor mayor a cero." };

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  if (field === "cost" && alsoPrice) {
    const { data, error } = await supabase.rpc("bulk_increase_cost_with_price", {
      p_org_id: organization.id,
      p_supplier_id: "supplierId" in groupBy ? groupBy.supplierId : null,
      p_brand: "brand" in groupBy ? groupBy.brand : null,
      p_percent: mode === "percent" ? value : null,
      p_fixed_amount: mode === "fixed" ? value : null,
    });
    if (error || !data) return { error: "No pudimos actualizar los costos y precios." };
    revalidatePath("/productos");
    revalidatePath("/pos");
    return { updatedCount: data.cost_count, priceUpdatedCount: data.price_count };
  }

  const { data, error } = await supabase.rpc("bulk_increase_field", {
    p_org_id: organization.id,
    p_field: field,
    p_supplier_id: "supplierId" in groupBy ? groupBy.supplierId : null,
    p_brand: "brand" in groupBy ? groupBy.brand : null,
    p_percent: mode === "percent" ? value : null,
    p_fixed_amount: mode === "fixed" ? value : null,
  });

  if (error) {
    return {
      error: field === "price" ? "No pudimos actualizar los precios." : "No pudimos actualizar los costos.",
    };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  return { updatedCount: data ?? 0 };
}

// Se pueden deshacer los aumentos masivos de los últimos 30 días (el mismo
// límite valida revert_bulk_price_change, migración 0039).
const BULK_UNDO_DAYS = 30;

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface BulkChangeInfo {
  groupLabel: string;
  amountLabel: string;
}

// "+13%" / "+$500" y "Distribuidora Norte" / "Marca Arcor" de cada aumento.
async function describeBulkChanges(
  supabase: Supabase,
  changes: {
    id: string;
    supplier_id: string | null;
    brand: string | null;
    percent: number | null;
    fixed_amount: number | null;
  }[]
): Promise<Map<string, BulkChangeInfo>> {
  const supplierIds = Array.from(
    new Set(changes.map((c) => c.supplier_id).filter((id): id is string => Boolean(id)))
  );
  const { data: suppliers } =
    supplierIds.length > 0
      ? await supabase.from("suppliers").select("id, name").in("id", supplierIds)
      : { data: [] as { id: string; name: string }[] };
  const supplierName = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  return new Map(
    changes.map((c) => [
      c.id,
      {
        groupLabel: c.brand
          ? `Marca ${c.brand}`
          : (c.supplier_id && supplierName.get(c.supplier_id)) || "Proveedor borrado",
        amountLabel:
          c.percent !== null
            ? `+${Number(c.percent).toLocaleString("es-AR")}%`
            : c.fixed_amount !== null
              ? `+${formatCurrency(Number(c.fixed_amount))}`
              : // Precio subido junto a un aumento de costo en monto fijo (0040).
                "Proporcional al costo",
      },
    ])
  );
}

async function memberLabels(
  supabase: Supabase,
  orgId: string,
  userIds: (string | null)[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return new Map();
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, username, email")
    .eq("org_id", orgId)
    .in("user_id", ids);
  return new Map(
    (members ?? []).map((m) => [m.user_id, m.username ?? m.email ?? "Alguien del equipo"])
  );
}

export interface BulkChangeRow extends BulkChangeInfo {
  id: string;
  productCount: number;
  createdAt: string;
  createdByLabel: string | null;
  reverted: boolean;
}

export async function getRecentBulkChanges(field: "price" | "cost"): Promise<BulkChangeRow[]> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const since = new Date(Date.now() - BULK_UNDO_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("bulk_price_changes")
    .select("id, supplier_id, brand, percent, fixed_amount, product_count, created_by, created_at, reverted_at")
    .eq("org_id", organization.id)
    .eq("field", field)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!rows || rows.length === 0) return [];

  const [info, members] = await Promise.all([
    describeBulkChanges(supabase, rows),
    memberLabels(supabase, organization.id, rows.map((r) => r.created_by)),
  ]);

  return rows.map((r) => ({
    id: r.id,
    ...info.get(r.id)!,
    productCount: r.product_count,
    createdAt: r.created_at,
    createdByLabel: r.created_by ? members.get(r.created_by) ?? null : null,
    reverted: r.reverted_at !== null,
  }));
}

export interface RevertBulkChangeResult extends ActionState {
  reverted?: number;
  skipped?: number;
}

export async function revertBulkChange(bulkChangeId: string): Promise<RevertBulkChangeResult> {
  await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("revert_bulk_price_change", {
    p_bulk_change_id: bulkChangeId,
  });

  if (error || !data) {
    if (error?.message.includes("ya se deshizo")) return { error: "Ese aumento ya se deshizo." };
    if (error?.message.includes("30 días")) {
      return { error: "Sólo se pueden deshacer aumentos de los últimos 30 días." };
    }
    return { error: "No pudimos deshacer el aumento." };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  return { reverted: data.reverted, skipped: data.skipped };
}

export interface ProductHistoryRow {
  id: string;
  oldValue: number;
  newValue: number;
  changedAt: string;
  changedByLabel: string | null;
  // Si el cambio vino de un aumento masivo (migración 0039).
  bulk: BulkChangeInfo | null;
}

interface HistoryDbRow {
  id: string;
  oldValue: number;
  newValue: number;
  changed_by: string | null;
  created_at: string;
  bulk_change_id: string | null;
}

async function fetchHistoryRows(
  supabase: Supabase,
  orgId: string,
  productId: string,
  field: "price" | "cost"
): Promise<HistoryDbRow[]> {
  // Pide bulk_change_id; si la columna todavía no existe (código publicado
  // antes de aplicar 0039) vuelve a pedir sin ella para no dejar el
  // historial vacío.
  const run = async (withBulk: boolean) => {
    if (field === "price") {
      const { data, error } = await supabase
        .from("product_price_history")
        .select(
          withBulk
            ? "id, old_price, new_price, changed_by, created_at, bulk_change_id"
            : "id, old_price, new_price, changed_by, created_at"
        )
        .eq("org_id", orgId)
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as unknown as {
        id: string;
        old_price: number;
        new_price: number;
        changed_by: string | null;
        created_at: string;
        bulk_change_id?: string | null;
      }[];
      return {
        error,
        rows: rows.map((r) => ({
          id: r.id,
          oldValue: Number(r.old_price),
          newValue: Number(r.new_price),
          changed_by: r.changed_by,
          created_at: r.created_at,
          bulk_change_id: r.bulk_change_id ?? null,
        })),
      };
    }
    const { data, error } = await supabase
      .from("product_cost_history")
      .select(
        withBulk
          ? "id, old_cost, new_cost, changed_by, created_at, bulk_change_id"
          : "id, old_cost, new_cost, changed_by, created_at"
      )
      .eq("org_id", orgId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as {
      id: string;
      old_cost: number;
      new_cost: number;
      changed_by: string | null;
      created_at: string;
      bulk_change_id?: string | null;
    }[];
    return {
      error,
      rows: rows.map((r) => ({
        id: r.id,
        oldValue: Number(r.old_cost),
        newValue: Number(r.new_cost),
        changed_by: r.changed_by,
        created_at: r.created_at,
        bulk_change_id: r.bulk_change_id ?? null,
      })),
    };
  };

  const first = await run(true);
  if (!first.error) return first.rows;
  return (await run(false)).rows;
}

export async function getProductHistory(
  productId: string,
  field: "price" | "cost"
): Promise<ProductHistoryRow[]> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const rows = await fetchHistoryRows(supabase, organization.id, productId, field);
  if (rows.length === 0) return [];

  const bulkIds = Array.from(
    new Set(rows.map((r) => r.bulk_change_id).filter((id): id is string => Boolean(id)))
  );
  const [members, bulkInfo] = await Promise.all([
    memberLabels(supabase, organization.id, rows.map((r) => r.changed_by)),
    bulkIds.length > 0
      ? supabase
          .from("bulk_price_changes")
          .select("id, supplier_id, brand, percent, fixed_amount")
          .in("id", bulkIds)
          .then(({ data }) => describeBulkChanges(supabase, data ?? []))
      : Promise.resolve(new Map<string, BulkChangeInfo>()),
  ]);

  return rows.map((r) => ({
    id: r.id,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedAt: r.created_at,
    changedByLabel: r.changed_by ? members.get(r.changed_by) ?? null : null,
    bulk: r.bulk_change_id ? bulkInfo.get(r.bulk_change_id) ?? null : null,
  }));
}

export async function revertProductField(
  productId: string,
  field: "price" | "cost",
  value: number
): Promise<ActionState> {
  if (!Number.isFinite(value) || value < 0) {
    return { error: field === "price" ? "Precio inválido." : "Costo inválido." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update(field === "price" ? { price: value } : { cost: value })
    .eq("id", productId)
    .eq("org_id", organization.id);

  if (error) {
    return { error: field === "price" ? "No pudimos volver a ese precio." : "No pudimos volver a ese costo." };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}
