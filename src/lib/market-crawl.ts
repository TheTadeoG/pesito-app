import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { brandMatches } from "@/lib/market-brands";
import {
  categoryPageUrl, categoryRank, fetchStorePrice, isInternalEan, MARKET_STORES, CRAWL_MAX_FROM, CRAWL_PAGE_SIZE, dedupeByEan, fetchJson, isBlockedCategory, leafCategories, parseVtexCatalogPage, type MarketStore,
} from "@/lib/market-prices";

// Recorrido de los catálogos de los súper (lo usan el cron mensual y el botón de /admin/precios). Sólo servidor.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Admin = ReturnType<typeof createAdminClient>;
type PriceInsert = Database["public"]["Tables"]["market_prices"]["Insert"];

const CRAWL_PAUSE_MS = 150;

interface CrawlRow {
  category: string;
  name: string | null;
  next_from: number;
  done: boolean;
}

// Categorías que se bajan a la vez por súper (cada una pide una página a la vez, con pausa).
const CONCURRENCY = 2;

/**
 * Recorre el catálogo de un súper por categorías, 50 productos por pedido, y guarda cada producto con
 * código de barras y precio (para el buscador). Retoma donde quedó (tabla market_crawl). Se saltea
 * los rubros que no sirven (electro, bazar…) y baja primero almacén, bebidas, limpieza, etc.
 */
export async function crawlStore(admin: Admin, store: MarketStore, month: string, until: number, brands: Set<string> | null) {
  const stats = { pages: 0, items: 0, categories: 0, errors: 0 };
  const table = () => admin.from("market_crawl");
  try {
    const { data: existing, error } = await table()
      .select("category, name, next_from, done")
      .eq("store", store.id)
      .eq("month", month)
      .limit(5000);
    if (error) throw new Error(error.message);
    let rows: CrawlRow[] = existing ?? [];

    // Sin lista del mes, o con la lista vieja (sin el rubro en el nombre): se lee el árbol de categorías.
    if (rows.length === 0 || rows.some((r) => !(r.name ?? "").includes(" > "))) {
      const tree = await fetchJson(`https://${store.host}/api/catalog_system/pub/category/tree/3`);
      const cats = leafCategories(tree);
      if (cats.length === 0) throw new Error("sin categorías");
      if (rows.length === 0) {
        const keep = cats.filter((c) => !isBlockedCategory(c.name));
        for (let i = 0; i < keep.length; i += 500) {
          const { error: insErr } = await table().upsert(
            keep.slice(i, i + 500).map((c) => ({ store: store.id, month, category: c.path, name: c.name })),
            { onConflict: "store,month,category" }
          );
          if (insErr) throw new Error(insErr.message);
        }
        rows = keep.map((c) => ({ category: c.path, name: c.name, next_from: 0, done: false }));
      } else {
        const byPath = new Map(cats.map((c) => [c.path, c.name]));
        for (const r of rows) {
          const full = byPath.get(r.category);
          if (!full || (r.name ?? "").includes(" > ")) continue;
          const skip = isBlockedCategory(full);
          await table().update({ name: full, ...(skip ? { done: true } : {}) }).eq("store", store.id).eq("month", month).eq("category", r.category);
          r.name = full;
          if (skip) r.done = true;
        }
      }
    }

    const queue = rows
      .filter((r) => !r.done && !isBlockedCategory(r.name))
      .sort((a, b) => categoryRank(a.name) - categoryRank(b.name));

    const crawlCategory = async (cat: CrawlRow) => {
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
      await table()
        .update({ next_from: from, done, items: added, updated_at: new Date().toISOString() })
        .eq("store", store.id)
        .eq("month", month)
        .eq("category", cat.category);
      if (done) stats.categories++;
    };

    const worker = async () => {
      while (Date.now() < until) {
        const cat = queue.shift();
        if (!cat) return;
        await crawlCategory(cat);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } catch (e) {
    stats.errors++;
    console.error("market-crawl", store.id, e instanceof Error ? e.message : e);
  }
  return stats;
}

const EAN_PAUSE_MS = 250;

/**
 * Busca, súper por súper, los códigos de barras de los productos de los negocios que todavía no
 * tienen el precio del mes (los más importantes: son los que se comparan con los precios propios).
 */
export async function scanEans(admin: Admin, month: string, limit: number, until: number) {
  const out = { considered: 0, done: 0, found: 0, missing: 0, failed: 0, error: false };
  const { data: pending, error } = await admin.rpc("market_pending_eans", { p_month: month, p_stores: MARKET_STORES.length, p_limit: limit });
  if (error) {
    console.error("market-prices pending", error.message);
    return { ...out, error: true };
  }
  const eans = (pending ?? []).map((r: { ean: string }) => r.ean);
  out.considered = eans.length;
  for (const ean of eans) {
    if (Date.now() > until) break;
    if (isInternalEan(ean)) {
      // Código propio de un negocio (200-299): no existe en los súper. Se anota como "no está" y listo.
      await admin.from("market_prices").upsert(
        MARKET_STORES.map((store) => ({ ean, store: store.id, month, found: false, price: null })),
        { onConflict: "ean,store,month", ignoreDuplicates: true }
      );
      out.done++;
      continue;
    }
    // Se saltea lo que ya está este mes (si una pasada anterior quedó a medias o lo trajo el recorrido).
    const { data: have } = await admin.from("market_prices").select("store").eq("ean", ean).eq("month", month);
    const haveStores = new Set((have ?? []).map((r) => r.store));
    // Los súper son sitios distintos: se les pregunta a la vez.
    await Promise.all(
      MARKET_STORES.filter((store) => !haveStores.has(store.id)).map(async (store) => {
        try {
          const p = await fetchStorePrice(store, ean);
          const row: PriceInsert = p
            ? { ean, store: store.id, month, found: true, price: p.price, list_price: p.listPrice, name: p.name, brand: p.brand, url: p.url, image_url: p.imageUrl, available: p.available }
            : { ean, store: store.id, month, found: false, price: null };
          const { error: upErr } = await admin.from("market_prices").upsert(row, { onConflict: "ean,store,month" });
          if (upErr) throw new Error(upErr.message);
          if (p) out.found++;
          else out.missing++;
        } catch (e) {
          out.failed++;
          console.error("market-prices", store.id, ean, e instanceof Error ? e.message : e);
        }
      })
    );
    await sleep(EAN_PAUSE_MS);
    out.done++;
  }
  return out;
}
