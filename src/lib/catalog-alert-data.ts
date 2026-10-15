import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { loadPriceHistory, type PriceChange } from "@/lib/product-insights";

// Qué productos disparan los avisos del catálogo que miran el historial o el margen. Una
// sola definición para la campana (cuenta) y para Productos (muestra cuáles son al filtrar),
// así el número del aviso y la lista que se abre siempre coinciden. Sólo servidor.

const DAY_MS = 24 * 60 * 60 * 1000;

interface P {
  id: string;
  cost: number | null;
  price: number;
  created_at: string;
}

/** Margen bajo: gana menos de `percent`% sobre el costo (sin llegar a vender a pérdida: eso es otro aviso). */
export function lowMarginIds(products: P[], percent: number): string[] {
  return products
    .filter((p) => p.cost !== null && p.cost > 0 && p.price >= p.cost && (p.price / p.cost - 1) * 100 < percent)
    .map((p) => p.id);
}

/** Costo sin actualizar: el costo no cambió en `days` días (los productos más nuevos que eso no cuentan). */
export async function staleCostIds(
  supabase: SupabaseClient<Database>,
  orgId: string,
  products: P[],
  days: number
): Promise<string[]> {
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const changes = await fetchAll((from, to) =>
    supabase
      .from("product_cost_history")
      .select("id, product_id")
      .eq("org_id", orgId)
      .gte("created_at", since)
      .order("id")
      .range(from, to)
  );
  const changed = new Set(changes.map((c) => c.product_id));
  return products
    .filter((p) => p.cost !== null && p.cost > 0 && p.created_at < since && !changed.has(p.id))
    .map((p) => p.id);
}

function groupByProduct(changes: PriceChange[]): Map<string, PriceChange[]> {
  const map = new Map<string, PriceChange[]>();
  for (const change of changes) {
    const list = map.get(change.product_id) ?? [];
    list.push(change);
    map.set(change.product_id, list);
  }
  return map;
}

/**
 * Precio sin actualizar: el costo subió (más de 1%) después del último cambio de precio. Es
 * el mismo caso "costo-subio" de las sugerencias de precio (lib/product-insights.ts).
 */
export function findCostRiseIds(products: P[], history: { prices: PriceChange[]; costs: PriceChange[] }): string[] {
  const prices = groupByProduct(history.prices);
  const costs = groupByProduct(history.costs);
  const out: string[] = [];
  for (const p of products) {
    if (p.cost === null || p.cost <= 0 || p.price <= 0) continue;
    const since = prices.get(p.id)?.at(-1)?.created_at ?? p.created_at;
    const costThen = (costs.get(p.id) ?? []).filter((c) => c.created_at > since)[0]?.old_value ?? 0;
    if (costThen > 0 && p.cost > costThen * 1.01) out.push(p.id);
  }
  return out;
}

export async function costRiseIds(supabase: SupabaseClient<Database>, orgId: string, products: P[]): Promise<string[]> {
  return findCostRiseIds(products, await loadPriceHistory(supabase, orgId));
}
