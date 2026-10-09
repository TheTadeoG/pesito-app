"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { getBranchContext, withBranchStock } from "@/lib/branches";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { computeIdleStock, parseSalesStats, type IdleStockRow } from "@/lib/product-insights";
import { IDLE_DAYS_OPTIONS } from "@/lib/idle-days";

/**
 * "Capital parado" de la pestaña Stock para otro período (7, 15, 30, 60 o 90 días). Plan IA:
 * `product_sales_stats` lo exige también en la base. No revalida páginas: la tarjeta aplica el resultado.
 */
export async function loadIdleStock(days: number): Promise<{ rows?: IdleStockRow[]; error?: string }> {
  if (!(IDLE_DAYS_OPTIONS as readonly number[]).includes(days)) return { error: "Período inválido." };
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  if (!canUse(await getSubscription(supabase, organization.id), "lowRotation")) {
    return { error: featureLockedMessage("lowRotation") };
  }
  const { current: branch } = await getBranchContext();

  const [rawProducts, stats] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, name, brand, barcode, unit, price, cost, stock, min_stock, default_supplier_id, created_at")
        .eq("org_id", organization.id)
        .eq("active", true)
        .order("id")
        .range(from, to)
    ),
    supabase.rpc("product_sales_stats", { p_org_id: organization.id, p_days: days, p_branch_id: branch?.id ?? null }),
  ]);
  if (stats.error) return { error: "No pudimos analizar las ventas. Probá de nuevo." };

  const withStock = await withBranchStock(supabase, branch, rawProducts);
  const products = withStock.map((p) => ({
    ...p,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
    pack_size: null,
  }));
  return { rows: computeIdleStock(products, parseSalesStats(stats.data), days) };
}
