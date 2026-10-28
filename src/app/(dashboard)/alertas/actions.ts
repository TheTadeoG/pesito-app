"use server";

import { loadMarketPrices, statsFor } from "@/lib/market-data";
import { diffPct, normalizeEan } from "@/lib/market-prices";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { getBranchContext, withBranchStock } from "@/lib/branches";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { Json } from "@/lib/database.types";
import { getSubscription } from "@/lib/subscription";
import { canUse } from "@/lib/plan-access";
import { alertEnabled, parseAlertSettings, type AlertSettings } from "@/lib/alert-config";
import { loadAlertSettings } from "@/lib/alert-settings";
import { countProductIssues, thresholdsFrom, type ProductIssueCounts } from "@/lib/product-alerts";
import { costRiseIds, staleCostIds } from "@/lib/catalog-alert-data";
import { computeIdleStock, parseSalesStats } from "@/lib/product-insights";
import { alertValue } from "@/lib/alert-config";
import { recentDifferences, recurringShortages, type CashAlertCounts } from "@/lib/caja-alerts";
import { getMemberLabelsById, memberLabelFor } from "@/lib/member-labels";

export interface BusinessAlertCounts {
  /** Productos activos: stock, números para revisar, precios y costos (de la sucursal actual). */
  products: ProductIssueCounts;
  /** Clientes con deuda de fiado y cuánto deben en total. */
  debtorCount: number;
  debtTotal: number;
  /** Faltantes y sobrantes al cerrar la caja (sólo dueño/administrador con el control por empleado; si no, null). */
  cash: CashAlertCounts | null;
}

// Lo pesado (historial de costos, ventas) se calcula una vez cada pocos minutos por negocio,
// sucursal y configuración: la campana pide los avisos al entrar y al abrirse, de muchas
// personas a la vez. Es un respiro por instancia del servidor, no una garantía.
const CACHE_MS = 3 * 60 * 1000;
const cache = new Map<string, { at: number; value: BusinessAlertCounts }>();

/**
 * Lo que la campana no sabe sin consultar: stock, números para revisar, precios y costos,
 * plata parada y fiado. Se pide una vez al entrar y de nuevo al abrir la campana si pasaron
 * unos minutos. Los números se cuentan aunque el plan no tenga gestión de stock (la campana
 * invita a desbloquear el detalle); lo que mira historial o ventas sólo se calcula con el
 * plan que lo trae y si el aviso no está apagado. No revalida páginas.
 */
export async function getBusinessAlerts(): Promise<BusinessAlertCounts | null> {
  try {
    const { userId, organization, membership } = await requireOrgContext();
    const supabase = await createClient();
    const branchContext = await getBranchContext();
    const [settings, subscription] = await Promise.all([
      loadAlertSettings(supabase, organization.id),
      getSubscription(supabase, organization.id),
    ]);

    // Por persona: los avisos de la caja nombran a quien cerró ("Vos" para quien pregunta) y sólo los ve quien administra.
    const key = `${organization.id}|${userId}|${branchContext.current?.id ?? ""}|${subscription.plan}${subscription.trialActive ? "t" : ""}|${JSON.stringify(settings)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    const [products, debtors] = await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("products")
          .select("id, name, brand, barcode, unit, stock, min_stock, cost, price, default_supplier_id, created_at")
          .eq("org_id", organization.id)
          .eq("active", true)
          .order("id")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("customers")
          .select("id, balance")
          .eq("org_id", organization.id)
          .gt("balance", 0)
          .order("id")
          .range(from, to)
      ),
    ]);

    const withStock = (await withBranchStock(supabase, branchContext.current, products)).map((p) => ({
      ...p,
      stock: Number(p.stock),
      min_stock: Number(p.min_stock),
      cost: p.cost === null ? null : Number(p.cost),
      price: Number(p.price),
    }));

    const thresholds = thresholdsFrom(settings);
    const counts = countProductIssues(withStock, thresholds);

    const [staleCost, costRise, idle] = await Promise.all([
      alertEnabled(settings, "stale-cost")
        ? staleCostIds(supabase, organization.id, withStock, thresholds.staleDays).then((ids) => ids.length)
        : 0,
      alertEnabled(settings, "cost-rise") && canUse(subscription, "costRiseAlert")
        ? costRiseIds(supabase, organization.id, withStock).then((ids) => ids.length)
        : 0,
      alertEnabled(settings, "idle-capital") && canUse(subscription, "lowRotation")
        ? supabase
            .rpc("product_sales_stats", {
              p_org_id: organization.id,
              p_days: thresholds.idleDays,
              p_branch_id: branchContext.current?.id ?? null,
            })
            .then(({ data, error }) => {
              if (error) return null;
              const rows = computeIdleStock(
                withStock.map((p) => ({ ...p, pack_size: null })),
                parseSalesStats(data),
                thresholds.idleDays
              );
              return { count: rows.length, capital: rows.reduce((n, r) => n + r.capital, 0) };
            })
        : null,
    ]);
    // Contra los supermercados (Plan Max): sólo productos con código de barras y precio juntado.
    const wantsMarket = alertEnabled(settings, "market-expensive") || alertEnabled(settings, "market-cheap");
    if (wantsMarket && canUse(subscription, "marketPriceInsights")) {
      const prices = await loadMarketPrices(supabase, organization.id, withStock.map((p) => p.barcode));
      for (const p of withStock) {
        const ean = normalizeEan(p.barcode);
        const stats = ean ? statsFor(prices.get(ean)) : null;
        if (!stats || !(p.price > 0)) continue;
        const d = diffPct(p.price, stats);
        if (d > thresholds.marketHighPct && alertEnabled(settings, "market-expensive")) counts.marketHigh += 1;
        if (d < -thresholds.marketLowPct && alertEnabled(settings, "market-cheap")) counts.marketLow += 1;
      }
    }
    counts.staleCost = staleCost;
    counts.costRise = costRise;
    counts.idleCount = idle?.count ?? 0;
    counts.idleCapital = idle?.capital ?? 0;

    // Faltantes y sobrantes: los últimos cierres de todas las cajas (Básico: control por empleado).
    let cash: CashAlertCounts | null = null;
    if (
      isOrgAdmin(membership.role) &&
      canUse(subscription, "teamReports") &&
      (alertEnabled(settings, "cash-difference") || alertEnabled(settings, "cash-shortage-repeat"))
    ) {
      const [closes, labels] = await Promise.all([
        supabase
          .from("cash_registers")
          .select("user_id, expected_amount, closing_amount, closed_at")
          .eq("org_id", organization.id)
          .eq("status", "cerrada")
          .order("closed_at", { ascending: false })
          .limit(150),
        getMemberLabelsById(supabase, organization.id),
      ]);
      const rows = closes.data ?? [];
      const threshold = alertValue(settings, "cash-difference");
      cash = {
        differences: recentDifferences(rows, threshold),
        repeated: recurringShortages(rows).map((r) => ({
          label: memberLabelFor(r.userId, userId, labels),
          faltanteCount: r.faltanteCount,
          consideredCount: r.consideredCount,
          totalFaltante: r.totalFaltante,
        })),
        threshold,
      };
    }

    const value: BusinessAlertCounts = {
      products: counts,
      debtorCount: debtors.length,
      debtTotal: debtors.reduce((sum, c) => sum + Number(c.balance), 0),
      cash,
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.error("getBusinessAlerts", e);
    return null;
  }
}

/** Guarda qué avisos están prendidos y con qué umbral (dueño o administrador, desde el Plan Básico). */
export async function saveAlertSettings(raw: AlertSettings): Promise<{ error?: string }> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede cambiar los avisos." };
  const supabase = await createClient();
  if (!canUse(await getSubscription(supabase, organization.id), "alertSettings")) {
    return { error: "Configurar los avisos es del Plan Básico en adelante." };
  }
  const settings = parseAlertSettings(raw);
  const { error } = await supabase.rpc("save_alert_settings", { p_org_id: organization.id, p_settings: settings as unknown as Json });
  if (error) {
    console.error("saveAlertSettings", error.message);
    return { error: error.message.includes("Plan") ? error.message : "No pudimos guardar. Probá de nuevo en un rato." };
  }
  revalidatePath("/configuracion");
  return {};
}
