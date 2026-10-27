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

/** Precios por EAN (los últimos que se juntaron). Un error de la base devuelve vacío: es información de apoyo. */
export async function loadMarketPrices(
  supabase: SupabaseClient<Database>,
  orgId: string,
  rawEans: (string | null | undefined)[]
): Promise<Map<string, MarketRow[]>> {
  const eans = Array.from(new Set(rawEans.map(normalizeEan).filter((e): e is string => e !== null)));
  const out = new Map<string, MarketRow[]>();
  for (let i = 0; i < eans.length; i += CHUNK) {
    const { data, error } = await supabase.rpc("market_prices_for", { p_org_id: orgId, p_eans: eans.slice(i, i + CHUNK) });
    if (error) {
      console.error("market_prices_for", error.message);
      continue;
    }
    for (const r of data ?? []) {
      const row: MarketRow = {
        ean: r.ean, store: r.store, price: Number(r.price), listPrice: r.list_price === null ? null : Number(r.list_price),
        name: r.name, brand: r.brand, url: r.url, available: r.available, month: r.month,
      };
      const list = out.get(r.ean);
      if (list) list.push(row);
      else out.set(r.ean, [row]);
    }
  }
  return out;
}

export function statsFor(rows: MarketRow[] | undefined): PriceStats | null {
  return rows ? priceStats(rows.map((r) => r.price)) : null;
}
