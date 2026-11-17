import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";

/** Un componente de un combo, con la cantidad que lleva. */
export interface BundleItem {
  componentId: string;
  quantity: number;
}

/**
 * Los combos y kits no tienen stock propio: cuántos se pueden armar sale del stock de sus componentes.
 * `stockOf` devuelve el stock actual de un producto (undefined si no se conoce).
 */
export function bundleCapacityOf(items: BundleItem[], stockOf: (id: string) => number | undefined): number {
  if (items.length === 0) return 0;
  let best = Infinity;
  for (const it of items) {
    const stock = stockOf(it.componentId);
    if (stock === undefined || !(it.quantity > 0)) return 0;
    best = Math.min(best, Math.floor((stock + 1e-9) / it.quantity));
  }
  return Number.isFinite(best) ? Math.max(0, best) : 0;
}

/**
 * Ids de los productos que son combos. Si todavía no está aplicada la migración de combos (0100), devuelve vacío
 * en vez de fallar, así las pantallas que lo usan para esconder combos de sus listas siguen andando.
 */
export async function fetchBundleIds(supabase: SupabaseClient<Database>, orgId: string): Promise<Set<string>> {
  try {
    const rows = await fetchAll((from, to) =>
      supabase.from("products").select("id").eq("org_id", orgId).eq("is_bundle", true).order("id").range(from, to)
    );
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/** Productos de cada combo ({ idDelCombo: [{ componentId, quantity }] }); vacío si falta la migración. */
export async function fetchBundleItems(supabase: SupabaseClient<Database>, orgId: string): Promise<Record<string, BundleItem[]>> {
  try {
    const rows = await fetchAll((from, to) =>
      supabase.from("product_bundle_items").select("id, bundle_id, component_id, quantity").eq("org_id", orgId).order("id").range(from, to)
    );
    const out: Record<string, BundleItem[]> = {};
    for (const r of rows) (out[r.bundle_id] ??= []).push({ componentId: r.component_id, quantity: Number(r.quantity) });
    return out;
  } catch {
    return {};
  }
}
