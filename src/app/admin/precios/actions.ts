"use server";

import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { brandFilter, brandMatches } from "@/lib/market-brands";
import { crawlStore, scanEans } from "@/lib/market-crawl";
import {
  categoryPageUrl, dedupeByEan, fetchJson, fetchStorePrice, leafCategories, MARKET_STORES, normalizeEan, parseVtexCatalogPage,
} from "@/lib/market-prices";

export interface StoreTestReport {
  store: string;
  ok: boolean;
  categories: number;
  pages: number;
  parsed: number;
  kept: number;
  saved: number;
  eanLookup: string;
  samples: string[];
  errors: string[];
}

const TEST_EAN = "7790895000782"; // Coca-Cola, para probar la consulta por código de barras
const PAGES_PER_STORE = 4;

/**
 * Prueba chica contra cada súper (sólo para el dueño de la plataforma): lee el árbol de categorías,
 * baja unas pocas páginas, aplica el filtro de marcas, guarda lo que sirve (datos reales del mes) y
 * prueba la consulta por código de barras. Devuelve qué pasó con cada súper.
 */
export async function runMarketTest(): Promise<{ reports: StoreTestReport[]; rowsThisMonth: number | null }> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const brands = brandFilter(process.env.MARKET_BRANDS);

  const reports = await Promise.all(
    MARKET_STORES.map(async (store): Promise<StoreTestReport> => {
      const r: StoreTestReport = { store: store.label, ok: false, categories: 0, pages: 0, parsed: 0, kept: 0, saved: 0, eanLookup: "—", samples: [], errors: [] };
      try {
        const tree = await fetchJson(`https://${store.host}/api/catalog_system/pub/category/tree/3`);
        const cats = leafCategories(tree);
        r.categories = cats.length;
        if (cats.length === 0) r.errors.push("El árbol de categorías vino vacío o con otro formato.");
        // Categorías repartidas a lo largo de la lista (no sólo las primeras).
        const step = Math.max(1, Math.floor(cats.length / PAGES_PER_STORE));
        const picks = cats.filter((_, i) => i % step === 0).slice(0, PAGES_PER_STORE);
        for (const cat of picks) {
          try {
            const json = await fetchJson(categoryPageUrl(store, cat.path, 0));
            const { items } = parseVtexCatalogPage(json);
            r.pages++;
            r.parsed += items.length;
            const kept = dedupeByEan(items.filter((i) => brandMatches(i.brand, brands)));
            r.kept += kept.length;
            if (kept.length > 0) {
              const batch: Database["public"]["Tables"]["market_prices"]["Insert"][] = kept.map((i) => ({
                ean: i.ean, store: store.id, month, found: true, price: i.price, list_price: i.listPrice,
                name: i.name, brand: i.brand, url: i.url, image_url: i.imageUrl, available: i.available,
              }));
              const { error } = await admin.from("market_prices").upsert(batch, { onConflict: "ean,store,month" });
              if (error) r.errors.push(`Guardar: ${error.message}`);
              else r.saved += kept.length;
              for (const i of kept.slice(0, 2)) if (r.samples.length < 3) r.samples.push(`${i.name} — $${i.price}`);
            }
          } catch (e) {
            r.errors.push(`${cat.name}: ${e instanceof Error ? e.message : String(e)}`);
          }
          await new Promise((res) => setTimeout(res, 300));
        }
        try {
          const p = await fetchStorePrice(store, TEST_EAN);
          r.eanLookup = p ? `encontrado: ${p.name} — $${p.price}` : "el súper no lo tiene (o no respondió con datos)";
        } catch (e) {
          r.eanLookup = `error: ${e instanceof Error ? e.message : String(e)}`;
        }
        r.ok = r.pages > 0 && r.parsed > 0 && r.errors.length === 0;
      } catch (e) {
        r.errors.push(e instanceof Error ? e.message : String(e));
      }
      return r;
    })
  );

  const { count } = await admin.from("market_prices").select("ean", { count: "exact", head: true }).eq("month", month);
  return { reports, rowsThisMonth: count ?? null };
}

export interface CrawlChunkReport {
  stores: { store: string; pages: number; items: number; categoriesDone: number; errors: number; pending: number | null }[];
  eans: { considered: number; done: number; internal: number; found: number; missing: number; failed: number };
  rowsThisMonth: number | null;
}

/**
 * Corre ahora un tramo del recorrido de catálogos (hasta ~4 minutos), igual que el cron. Se puede
 * apretar varias veces: cada vez sigue donde quedó la anterior.
 */
export async function runCrawlChunk(): Promise<CrawlChunkReport> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const brands = brandFilter(process.env.MARKET_BRANDS);
  // Primero los códigos de barras de los productos de los negocios (lo que se compara); después los catálogos.
  const eans = await scanEans(admin, month, 200, Date.now() + 70_000);
  const until = Date.now() + 170_000;
  const stats = await Promise.all(MARKET_STORES.map((store) => crawlStore(admin, store, month, until, brands)));
  const stores = await Promise.all(
    MARKET_STORES.map(async (store, i) => {
      const { count } = await admin
        .from("market_crawl")
        .select("category", { count: "exact", head: true })
        .eq("store", store.id)
        .eq("month", month)
        .eq("done", false);
      return { store: store.label, pages: stats[i].pages, items: stats[i].items, categoriesDone: stats[i].categories, errors: stats[i].errors, pending: count ?? null };
    })
  );
  const { count } = await admin.from("market_prices").select("ean", { count: "exact", head: true }).eq("month", month);
  return { stores, eans, rowsThisMonth: count ?? null };
}

export interface ProbeReport {
  store: string;
  byCode: string;
  byText: string[];
  error?: string;
}

/**
 * Prueba un producto en vivo contra cada súper: por código de barras y por texto (para ver con qué
 * código lo tiene cada uno). No guarda nada.
 */
export async function probeProduct(code: string, text: string): Promise<ProbeReport[]> {
  await requirePlatformAdmin();
  const ean = normalizeEan(code);
  const q = text.trim().slice(0, 80);
  return Promise.all(
    MARKET_STORES.map(async (store): Promise<ProbeReport> => {
      const r: ProbeReport = { store: store.label, byCode: "—", byText: [] };
      try {
        if (ean) {
          const p = await fetchStorePrice(store, ean);
          r.byCode = p ? `encontrado: ${p.name} — $${p.price}` : "ese código no está en este súper";
        } else if (code.trim()) {
          r.byCode = "código inválido (tiene que tener 8, 12, 13 o 14 dígitos)";
        }
        if (q) {
          const json = await fetchJson(`https://${store.host}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=5`);
          r.byText = parseVtexCatalogPage(json).items.slice(0, 6).map((i) => `${i.ean} · ${i.name} — $${i.price}`);
          if (r.byText.length === 0) r.byText = ["sin resultados"];
        }
      } catch (e) {
        r.error = e instanceof Error ? e.message : String(e);
      }
      return r;
    })
  );
}
