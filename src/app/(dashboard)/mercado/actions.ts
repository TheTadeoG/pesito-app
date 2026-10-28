"use server";

import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { loadMarketPrices } from "@/lib/market-data";
import { diffPct, normalizeEan, priceStats, pricePosition, type PricePosition, type PriceStats } from "@/lib/market-prices";
import { alertValue } from "@/lib/alert-config";
import { loadAlertSettings } from "@/lib/alert-settings";
import type { Plan } from "@/lib/subscription";

export type MarketHint =
  | { state: "invalid" }
  | { state: "locked"; plan: Plan }
  | { state: "none" }
  | { state: "ok"; stats: PriceStats; stores: { store: string; price: number }[]; insights: boolean; insightsPlan: Plan };

/** Precios de supermercados de un código de barras, para el formulario de producto (sólo lectura). */
export async function getMarketHint(rawEan: string): Promise<MarketHint> {
  const ean = normalizeEan(rawEan);
  if (!ean) return { state: "invalid" };
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "supermarketPrices")) return { state: "locked", plan: featureMinPlan.supermarketPrices };
  const rows = (await loadMarketPrices(supabase, organization.id, [ean])).get(ean);
  const stats = rows ? priceStats(rows.map((r) => r.price)) : null;
  if (!rows || !stats) return { state: "none" };
  return {
    state: "ok",
    stats,
    stores: rows.map((r) => ({ store: r.store, price: r.price })),
    insights: canUse(subscription, "marketPriceInsights"),
    insightsPlan: featureMinPlan.marketPriceInsights,
  };
}

export interface MarketSearchItem {
  ean: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  minPrice: number;
  stores: { store: string; price: number; url: string | null; available: boolean }[];
  /** Si el negocio ya tiene ese producto (mismo código de barras). */
  mine: { name: string; price: number; position: PricePosition | null; diff: number | null } | null;
}

export interface MarketSearchResult {
  error?: string;
  total: number;
  items: MarketSearchItem[];
}

/** Busca por nombre en los catálogos de los supermercados (Plan Pro). La posición caro/barato es del Plan Max. */
export async function searchMarket(query: string, page: number, pageSize: number): Promise<MarketSearchResult> {
  const q = typeof query === "string" ? query.trim().slice(0, 80) : "";
  if (q.length < 2) return { total: 0, items: [] };
  const size = Math.min(Math.max(Math.floor(pageSize) || 25, 1), 100);
  const offset = Math.max(Math.floor(page) || 0, 0) * size;
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "supermarketPrices")) return { error: "La búsqueda en supermercados es del Plan Pro.", total: 0, items: [] };

  const { data, error } = await supabase.rpc("market_search", { p_org_id: organization.id, p_query: q, p_limit: size, p_offset: offset });
  if (error) {
    console.error("market_search", error.message);
    return { error: "No pudimos buscar ahora. Probá de nuevo en un rato.", total: 0, items: [] };
  }
  const rows = data ?? [];
  const eans = rows.map((r) => r.ean);
  const mineByEan = new Map<string, { name: string; price: number }>();
  if (eans.length > 0) {
    const { data: mine } = await supabase
      .from("products")
      .select("name, price, barcode")
      .eq("org_id", organization.id)
      .eq("active", true)
      .in("barcode", eans);
    for (const p of mine ?? []) if (p.barcode) mineByEan.set(p.barcode, { name: p.name, price: Number(p.price) });
  }
  const insights = canUse(subscription, "marketPriceInsights");
  const settings = insights ? await loadAlertSettings(supabase, organization.id) : {};
  const limits = { highPct: alertValue(settings, "market-expensive"), lowPct: alertValue(settings, "market-cheap") };

  const items: MarketSearchItem[] = rows.map((r) => {
    const stores = (Array.isArray(r.stores) ? (r.stores as unknown as { store: string; price: number; url: string | null; available: boolean }[]) : []).map((x) => ({
      store: String(x.store), price: Number(x.price), url: x.url ?? null, available: x.available !== false,
    }));
    const m = mineByEan.get(r.ean);
    const stats = priceStats(stores.map((x) => x.price));
    return {
      ean: r.ean,
      name: r.name,
      brand: r.brand,
      imageUrl: r.image_url,
      minPrice: Number(r.min_price),
      stores,
      mine: m
        ? {
            name: m.name,
            price: m.price,
            position: insights && stats && m.price > 0 ? pricePosition(m.price, stats, limits) : null,
            diff: insights && stats && m.price > 0 ? diffPct(m.price, stats) : null,
          }
        : null,
    };
  });
  return { total: rows.length > 0 ? Number(rows[0].total) : 0, items };
}
