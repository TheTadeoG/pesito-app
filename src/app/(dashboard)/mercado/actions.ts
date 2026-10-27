"use server";

import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { loadMarketPrices } from "@/lib/market-data";
import { normalizeEan, priceStats, type PriceStats } from "@/lib/market-prices";
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
