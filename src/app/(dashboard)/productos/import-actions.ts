"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { getProductUsage } from "@/lib/plan-limits";
import { getBranchContext } from "@/lib/branches";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  IMPORT_CHUNK_SIZE,
  IMPORT_UNITS,
  UPDATE_FIELDS,
  normalizeText,
  type ImportRow,
  type UpdateField,
} from "@/lib/product-import";

export interface ImportOptions {
  /**
   * Si el producto ya existe (mismo código de barras o SKU): qué datos se
   * actualizan con los de la planilla. Vacío = se deja como está.
   */
  updateFields: UpdateField[];
  /** Última tanda del archivo: recién ahí se refresca la pantalla. */
  last: boolean;
}

export interface ImportChunkResult {
  error?: string;
  created: number;
  updated: number;
  /** Ya existían y no se tocaron (o no entraban en el límite del plan). */
  skipped: number;
  problems: { line: number; message: string }[];
}

const empty = (): ImportChunkResult => ({ created: 0, updated: 0, skipped: 0, problems: [] });

function key(value: string): string {
  return value.trim().toLowerCase();
}

// Una tanda de la carga masiva. La planilla se lee en el navegador y llega
// por partes (IMPORT_CHUNK_SIZE filas) para no pasar el tamaño máximo de una
// llamada. Todo se revalida acá: el navegador no es de fiar.
export async function importProductsChunk(
  rows: ImportRow[],
  options: ImportOptions
): Promise<ImportChunkResult> {
  const result = empty();
  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();

  if (!isOrgAdmin(membership.role)) {
    return { ...result, error: "Sólo quien administra el negocio puede cargar productos de forma masiva." };
  }
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "productImport")) {
    return { ...result, error: featureLockedMessage("productImport") };
  }
  if (!Array.isArray(rows) || rows.length === 0) return result;
  if (rows.length > IMPORT_CHUNK_SIZE) {
    return { ...result, error: "Llegaron demasiados productos juntos. Probá de nuevo." };
  }

  // Lo que ya existe, para no duplicar (por código de barras y por SKU).
  const existing = await fetchAll((from, to) =>
    supabase
      .from("products")
      .select("id, barcode, sku")
      .eq("org_id", organization.id)
      .order("id")
      .range(from, to)
  );
  const byBarcode = new Map<string, string>();
  const bySku = new Map<string, string>();
  for (const p of existing) {
    if (p.barcode) byBarcode.set(key(p.barcode), p.id);
    if (p.sku) bySku.set(key(p.sku), p.id);
  }

  // Marcas nuevas (una por nombre, sin importar mayúsculas ni acentos).
  const { data: brandRows } = await supabase.from("brands").select("name").eq("org_id", organization.id);
  const knownBrands = new Set((brandRows ?? []).map((b) => normalizeText(b.name)));

  const { used, limit } = await getProductUsage(supabase, organization.id);
  let capacity = Math.max(0, limit - used);

  const { current: branch } = await getBranchContext();

  type Clean = {
    line: number;
    payload: {
      org_id: string;
      name: string;
      barcode: string | null;
      sku: string | null;
      brand: string | null;
      cost: number | null;
      price: number;
      min_stock: number;
      unit: string;
    };
    stock: number;
  };
  const toCreate: Clean[] = [];
  type ProductPatch = Database["public"]["Tables"]["products"]["Update"];
  const toUpdate: { line: number; id: string; patch: ProductPatch }[] = [];
  const seenInChunk = new Set<string>();

  for (const raw of rows) {
    const line = Number(raw.line) || 0;
    const name = String(raw.name ?? "").trim();
    const price = Number(raw.price);
    const cost = raw.cost === null || raw.cost === undefined ? null : Number(raw.cost);
    const stock = Number(raw.stock ?? 0);
    const minStock = Number(raw.minStock ?? 0);
    const unit = String(raw.unit ?? "u");
    const barcode = String(raw.barcode ?? "").trim();
    const sku = String(raw.sku ?? "").trim();
    const brand = String(raw.brand ?? "").trim();

    if (
      !name ||
      name.length > 200 ||
      !Number.isFinite(price) ||
      price < 0 ||
      (cost !== null && (!Number.isFinite(cost) || cost < 0)) ||
      !Number.isFinite(stock) ||
      stock < 0 ||
      !Number.isFinite(minStock) ||
      minStock < 0 ||
      !(IMPORT_UNITS as readonly string[]).includes(unit)
    ) {
      result.problems.push({ line, message: "Los datos de esta fila no son válidos." });
      continue;
    }

    const existingId =
      (barcode && byBarcode.get(key(barcode))) || (sku && bySku.get(key(sku))) || null;
    if (existingId) {
      const fields = new Set(
        (Array.isArray(options.updateFields) ? options.updateFields : []).filter((f) =>
          UPDATE_FIELDS.some((u) => u.field === f)
        )
      );
      if (fields.size === 0) {
        result.skipped++;
        continue;
      }
      const patch: ProductPatch = {};
      if (fields.has("price")) patch.price = price;
      if (fields.has("cost") && cost !== null) patch.cost = cost;
      if (fields.has("brand") && brand) patch.brand = brand;
      if (fields.has("name")) patch.name = name;
      if (fields.has("minStock")) patch.min_stock = minStock;
      if (fields.has("unit")) patch.unit = unit;
      // Un SKU o código que ya usa otro producto no se pisa (rompería la búsqueda).
      if (fields.has("sku") && sku && (bySku.get(key(sku)) ?? existingId) === existingId) patch.sku = sku;
      if (fields.has("barcode") && barcode && (byBarcode.get(key(barcode)) ?? existingId) === existingId) {
        patch.barcode = barcode;
      }
      if (Object.keys(patch).length === 0) {
        result.skipped++;
        continue;
      }
      toUpdate.push({ line, id: existingId, patch });
      continue;
    }

    // Repetido dentro del mismo archivo: el primero gana.
    const dupKey = barcode ? `b:${key(barcode)}` : sku ? `s:${key(sku)}` : null;
    if (dupKey && seenInChunk.has(dupKey)) {
      result.skipped++;
      continue;
    }
    if (dupKey) seenInChunk.add(dupKey);

    if (capacity <= 0) {
      result.skipped++;
      result.problems.push({ line, message: `“${name}”: no entra, se llegó al límite de productos de tu plan.` });
      continue;
    }
    capacity--;

    toCreate.push({
      line,
      stock,
      payload: {
        org_id: organization.id,
        name,
        barcode: barcode || null,
        sku: sku || null,
        brand: brand || null,
        cost,
        price,
        min_stock: minStock,
        unit,
      },
    });
  }

  // Marcas que todavía no existen.
  const newBrands = new Map<string, string>();
  for (const item of toCreate) {
    const brand = item.payload.brand;
    if (brand && !knownBrands.has(normalizeText(brand)) && !newBrands.has(normalizeText(brand))) {
      newBrands.set(normalizeText(brand), brand);
    }
  }
  for (const item of toUpdate) {
    const brand = item.patch.brand ?? undefined;
    if (brand && !knownBrands.has(normalizeText(brand)) && !newBrands.has(normalizeText(brand))) {
      newBrands.set(normalizeText(brand), brand);
    }
  }
  if (newBrands.size > 0) {
    await supabase
      .from("brands")
      .insert([...newBrands.values()].map((name) => ({ org_id: organization.id, name })));
  }

  // Productos nuevos. Con sucursales el stock inicial se carga en la sucursal
  // actual (un insert con stock iría a la principal).
  if (toCreate.length > 0) {
    const insertRows = toCreate.map((c) => ({ ...c.payload, stock: branch ? 0 : c.stock }));
    const { data: created, error } = await supabase
      .from("products")
      .insert(insertRows)
      .select("id, barcode, sku");

    let createdItems: { id: string; item: Clean }[] = [];
    if (!error && created) {
      created.forEach((row, index) => createdItems.push({ id: row.id, item: toCreate[index] }));
    } else {
      // Alguna fila falló: una por una para saber cuál (y guardar el resto).
      createdItems = [];
      for (let i = 0; i < toCreate.length; i++) {
        const c = toCreate[i];
        const { data, error: rowError } = await supabase
          .from("products")
          .insert({ ...c.payload, stock: branch ? 0 : c.stock })
          .select("id")
          .single();
        if (rowError || !data) {
          result.problems.push({ line: c.line, message: `“${c.payload.name}”: no pudimos guardarlo.` });
        } else {
          createdItems.push({ id: data.id, item: c });
        }
      }
    }
    result.created = createdItems.length;

    if (branch) {
      const withStock = createdItems.filter((c) => c.item.stock > 0);
      for (let i = 0; i < withStock.length; i += 10) {
        await Promise.all(
          withStock.slice(i, i + 10).map(async ({ id, item }) => {
            const { error: stockError } = await supabase.rpc("adjust_branch_stock", {
              p_branch_id: branch.id,
              p_product_id: id,
              p_delta: item.stock,
              p_reason: "Stock inicial (carga masiva)",
            });
            if (stockError) {
              result.problems.push({
                line: item.line,
                message: `“${item.payload.name}”: se creó, pero no pudimos cargar el stock inicial.`,
              });
            }
          })
        );
      }
    }
  }

  // Productos que ya existían: precio, costo y marca (el stock no se toca).
  for (let i = 0; i < toUpdate.length; i += 10) {
    await Promise.all(
      toUpdate.slice(i, i + 10).map(async ({ line, id, patch }) => {
        const { error } = await supabase
          .from("products")
          .update(patch)
          .eq("id", id)
          .eq("org_id", organization.id);
        if (error) result.problems.push({ line, message: "No pudimos actualizar un producto que ya existía." });
        else result.updated++;
      })
    );
  }

  if (options.last) {
    revalidatePath("/productos");
    revalidatePath("/pos");
    revalidatePath("/compras");
  }

  return result;
}
