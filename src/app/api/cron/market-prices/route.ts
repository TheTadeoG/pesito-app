import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import {
  categoryPageUrl, CRAWL_MAX_FROM, CRAWL_PAGE_SIZE, dedupeByEan, fetchJson, fetchStorePrice, leafCategories,
  MARKET_STORES, parseVtexCatalogPage, type MarketStore,
} from "@/lib/market-prices";

// Precios de supermercados por EAN (migración 0078). La llama un cron los días 1 a 10 de cada mes
// (vercel.json) con "Authorization: Bearer $CRON_SECRET"; cada pasada completa un tramo de los EAN que
// todavía no tienen el precio del mes en todos los súper (así no se golpea a un súper con ráfagas) y,
// cuando ya están todos, no hace nada. Apagada hasta poner MARKET_SCAN_ENABLED=true en Vercel.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EANS_PER_RUN = 120;
const PAUSE_MS = 250;
const DEADLINE_MS = 270_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Admin = ReturnType<typeof createAdminClient>;
type PriceInsert = Database["public"]["Tables"]["market_prices"]["Insert"];

const CRAWL_DEADLINE_MS = 170_000; // el recorrido de catálogos usa hasta acá; el resto es para los EAN de los negocios
const CRAWL_PAUSE_MS = 300;

/**
 * Recorre el catálogo de un súper por categorías, 50 productos por pedido, y guarda cada producto con
 * código de barras y precio (para el buscador). Retoma donde quedó (tabla market_crawl).
 */
async function crawlStore(admin: Admin, store: MarketStore, month: string, until: number) {
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
        const unique = dedupeByEan(items);
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

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse(null, { status: 401 });
  if (process.env.MARKET_SCAN_ENABLED !== "true") return NextResponse.json({ enabled: false });

  const started = Date.now();
  const admin = createAdminClient();
  const month = new Date().toISOString().slice(0, 7) + "-01";

  // 0) Limpieza: se guardan los últimos 3 meses (con 2 alcanza para mostrar y comparar); lo viejo se borra.
  const keepFrom = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 3, 1)).toISOString().slice(0, 10);
  await admin.from("market_prices").delete().lt("month", keepFrom);
  await admin.from("market_crawl").delete().lt("month", keepFrom);

  // 1) Catálogos completos (buscador). Apagado hasta MARKET_CATALOG_ENABLED=true.
  let crawl: Record<string, { pages: number; items: number; categories: number; errors: number }> | null = null;
  if (process.env.MARKET_CATALOG_ENABLED === "true") {
    const until = started + CRAWL_DEADLINE_MS;
    const results = await Promise.all(MARKET_STORES.map((store) => crawlStore(admin, store, month, until)));
    crawl = Object.fromEntries(MARKET_STORES.map((store, i) => [store.id, results[i]]));
  }

  // 2) Los códigos de barras de los negocios que todavía falten.
  const { data: pending, error } = await admin.rpc("market_pending_eans", {
    p_month: month,
    p_stores: MARKET_STORES.length,
    p_limit: EANS_PER_RUN,
  });
  if (error) {
    console.error("market-prices pending", error.message);
    return NextResponse.json({ error: "no se pudo leer la lista" }, { status: 500 });
  }

  const eans = (pending ?? []).map((r: { ean: string }) => r.ean);
  let found = 0;
  let missing = 0;
  let failed = 0;
  let done = 0;

  for (const ean of eans) {
    if (Date.now() - started > DEADLINE_MS) break;
    // Se saltea lo que ya está este mes (si una pasada anterior quedó a medias).
    const { data: have } = await admin.from("market_prices").select("store").eq("ean", ean).eq("month", month);
    const haveStores = new Set((have ?? []).map((r) => r.store));
    for (const store of MARKET_STORES) {
      if (haveStores.has(store.id)) continue;
      try {
        const p = await fetchStorePrice(store, ean);
        const row: Database["public"]["Tables"]["market_prices"]["Insert"] = p
          ? { ean, store: store.id, month, found: true, price: p.price, list_price: p.listPrice, name: p.name, brand: p.brand, url: p.url, image_url: p.imageUrl, available: p.available }
          : { ean, store: store.id, month, found: false, price: null };
        const { error: upErr } = await admin.from("market_prices").upsert(row, { onConflict: "ean,store,month" });
        if (upErr) throw new Error(upErr.message);
        if (p) found++;
        else missing++;
      } catch (e) {
        failed++;
        console.error("market-prices", store.id, ean, e instanceof Error ? e.message : e);
      }
      await sleep(PAUSE_MS);
    }
    done++;
  }

  return NextResponse.json({ enabled: true, month, crawl, considered: eans.length, done, found, missing, failed });
}
