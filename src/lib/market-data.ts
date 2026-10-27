import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizeEan, priceStats, type PriceStats } from "@/lib/market-prices";

// Lectura de los precios de supermercados para un negocio (market_prices_for, plan Pro). Sólo servidor.

export interface MarketRow {
  ean: string;
  store: string;
  price: number;
  listPrice: number | null;
  name: string | null;
  brand: string | null;
  url: string | null;
  available: boolean;
  month: string;
}

const CHUNK = 300;

// Los precios se juntan una vez por mes: no hace falta preguntarle a la base en cada visita. Se
// guardan por código de barras en la memoria del servidor (son iguales para todos los negocios) y
// se vuelven a pedir pasadas unas horas. Quien llama ya comprobó el plan (Pro); la base lo exige
// de nuevo cada vez que sí se consulta.
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHED = 20000;
const cache = new Map<string, { at: number; rows: MarketRow[] }>();

/** Precios por EAN (los últimos que se juntaron). Un error de la base devuelve vacío: es información de apoyo. */
export async function loadMarketPrices(
  supabase: SupabaseClient<Database>,
  orgId: string,
  rawEans: (string | null | undefined)[]
): Promise<Map<string, MarketRow[]>> {
  const eans = Array.from(new Set(rawEans.map(normalizeEan).filter((e): e is string => e !== null)));
  const out = new Map<string, MarketRow[]>();
  const now = Date.now();
  const missing: string[] = [];
  for (const ean of eans) {
    const hit = cache.get(ean);
    if (hit && now - hit.at < TTL_MS) {
      if (hit.rows.length > 0) out.set(ean, hit.rows);
    } else missing.push(ean);
  }
  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK);
    const { data, error } = await supabase.rpc("market_prices_for", { p_org_id: orgId, p_eans: chunk });
    if (error) {
      console.error("market_prices_for", error.message);
      continue;
    }
    const fresh = new Map<string, MarketRow[]>(chunk.map((e) => [e, []]));
    for (const r of data ?? []) {
      fresh.get(r.ean)?.push({
        ean: r.ean, store: r.store, price: Number(r.price), listPrice: r.list_price === null ? null : Number(r.list_price),
        name: r.name, brand: r.brand, url: r.url, available: r.available, month: r.month,
      });
    }
    if (cache.size > MAX_CACHED) cache.clear();
    for (const [ean, rows] of fresh) {
      cache.set(ean, { at: now, rows });
      if (rows.length > 0) out.set(ean, rows);
    }
  }
  return out;
}

export function statsFor(rows: MarketRow[] | undefined): PriceStats | null {
  return rows ? priceStats(rows.map((r) => r.price)) : null;
}
