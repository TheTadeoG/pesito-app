"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { ValuationRow } from "@/components/dashboard/valuation-lists";

export interface StockBreakdown {
  byBrand: ValuationRow[];
  bySupplier: ValuationRow[];
}

/**
 * Cuánta plata hay en mercadería por marca y por proveedor (stock × costo de los productos activos).
 * Se calcula recién cuando se pide desde Reportes, para no cargar todos los productos en cada visita.
 * Plan Esencial (gestión de stock). No revalida páginas.
 */
export async function loadStockBreakdown(): Promise<{ data?: StockBreakdown; error?: string }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  if (!canUse(await getSubscription(supabase, organization.id), "stockManagement")) {
    return { error: featureLockedMessage("stockManagement") };
  }

  const [products, { data: suppliers }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, brand, default_supplier_id, stock, cost")
        .eq("org_id", organization.id)
        .eq("active", true)
        .order("id")
        .range(from, to)
    ),
    supabase.from("suppliers").select("id, name").eq("org_id", organization.id),
  ]);
  const supplierName = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  const byBrand = new Map<string, ValuationRow>();
  const bySupplier = new Map<string, ValuationRow>();
  for (const p of products) {
    const stock = Number(p.stock);
    const value = stock * Number(p.cost ?? 0);
    const brandLabel = p.brand?.trim() || "Sin marca";
    const b = byBrand.get(brandLabel) ?? { label: brandLabel, units: 0, value: 0 };
    b.units += stock;
    b.value += value;
    byBrand.set(brandLabel, b);

    const key = p.default_supplier_id ?? "__none__";
    const label = p.default_supplier_id ? (supplierName.get(p.default_supplier_id) ?? "Proveedor eliminado") : "Sin proveedor";
    const s = bySupplier.get(key) ?? { label, units: 0, value: 0 };
    s.units += stock;
    s.value += value;
    bySupplier.set(key, s);
  }
  const sort = (m: Map<string, ValuationRow>) => Array.from(m.values()).sort((a, b) => b.value - a.value);
  return { data: { byBrand: sort(byBrand), bySupplier: sort(bySupplier) } };
}
