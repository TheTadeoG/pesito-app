import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { brandMatches } from "@/lib/market-brands";
import {
  categoryPageUrl, CRAWL_MAX_FROM, CRAWL_PAGE_SIZE, dedupeByEan, fetchJson, leafCategories, parseVtexCatalogPage, type MarketStore,
} from "@/lib/market-prices";

// Recorrido de los catálogos de los súper (lo usan el cron mensual y el botón de /admin/precios). Sólo servidor.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Admin = ReturnType<typeof createAdminClient>;
type PriceInsert = Database["public"]["Tables"]["market_prices"]["Insert"];

const CRAWL_PAUSE_MS = 150;

/**
 * Recorre el catálogo de un súper por categorías, 50 productos por pedido, y guarda cada producto con
 * código de barras y precio (para el buscador). Retoma donde quedó (tabla market_crawl).
 */
export async function crawlStore(admin: Admin, store: MarketStore, month: string, until: number, brands: Set<string> | null) {
  const stats = { pages: 0, items: 0, categories: 0, errors: 0 };
  try {
    const { data: existing, error } = await admin
      .from("market_crawl")
      .select("category, next_from, done")
      .eq("store", store.id)
      .eq("month", month)
      .limit(5000);
    if (error) throw new Error(error.message);
    let rows = existing ?? [];

    if (rows.length === 0) {
      const tree = await fetchJson(`https://${store.host}/api/catalog_system/pub/category/tree/3`);
      const cats = leafCategories(tree);
      if (cats.length === 0) throw new Error("sin categorías");
      for (let i = 0; i < cats.length; i += 500) {
        const { error: insErr } = await admin
          .from("market_crawl")
          .upsert(cats.slice(i, i + 500).map((c) => ({ store: store.id, month, category: c.path, name: c.name })), { onConflict: "store,month,category" });
        if (insErr) throw new Error(insErr.message);
      }
      rows = cats.map((c) => ({ category: c.path, next_from: 0, done: false }));
    }

    for (const cat of rows) {
      if (cat.done) continue;
      let from = cat.next_from;
      let done = false;
      let added = 0;
      while (Date.now() < until) {
        let json: unknown;
        try {
          json = await fetchJson(categoryPageUrl(store, cat.category, from));
        } catch (e) {
          stats.errors++;
          console.error("market-crawl", store.id, cat.category, e instanceof Error ? e.message : e);
          break; // se reintenta en otra pasada
        }
        const { items, products } = parseVtexCatalogPage(json);
        stats.pages++;
        const unique = dedupeByEan(items.filter((i) => brandMatches(i.brand, brands)));
        if (unique.length > 0) {
          const batch: PriceInsert[] = unique.map((i) => ({
            ean: i.ean, store: store.id, month, found: true, price: i.price, list_price: i.listPrice,
            name: i.name, brand: i.brand, url: i.url, image_url: i.imageUrl, available: i.available,
          }));
          const { error: upErr } = await admin.from("market_prices").upsert(batch, { onConflict: "ean,store,month" });
          if (upErr) {
            stats.errors++;
            console.error("market-crawl upsert", store.id, upErr.message);
            break;
          }
          added += unique.length;
          stats.items += unique.length;
        }
        from += CRAWL_PAGE_SIZE;
        if (products < CRAWL_PAGE_SIZE || from > CRAWL_MAX_FROM) {
          done = true;
          break;
        }
        await sleep(CRAWL_PAUSE_MS);
      }
      await admin
        .from("market_crawl")
        .update({ next_from: from, done, items: added, updated_at: new Date().toISOString() })
        .eq("store", store.id)
        .eq("month", month)
        .eq("category", cat.category);
      if (done) stats.categories++;
      if (Date.now() >= until) break;
    }
  } catch (e) {
    stats.errors++;
    console.error("market-crawl", store.id, e instanceof Error ? e.message : e);
  }
  return stats;
}

