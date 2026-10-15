"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { getBranchContext, withBranchStock } from "@/lib/branches";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { countProductIssues, type ProductIssueCounts } from "@/lib/product-alerts";

export interface BusinessAlertCounts {
  /** Productos activos: stock bajo y números para revisar (de la sucursal actual). */
  products: ProductIssueCounts;
  /** Clientes con deuda de fiado y cuánto deben en total. */
  debtorCount: number;
  debtTotal: number;
}

/**
 * Lo que la campana no sabe sin consultar: stock bajo, números para revisar y fiado. Se pide una vez al
 * entrar y de nuevo al abrir la campana si pasaron unos minutos. Los números se
 * cuentan aunque el plan no tenga gestión de stock (la campana invita a desbloquear
 * el detalle). No revalida páginas.
 */
export async function getBusinessAlerts(): Promise<BusinessAlertCounts | null> {
  try {
    const { organization } = await requireOrgContext();
    const supabase = await createClient();
    const branchContext = await getBranchContext();

    const [products, debtors] = await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("products")
          .select("id, stock, min_stock, cost")
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

    const withStock = await withBranchStock(supabase, branchContext.current, products);
    return {
      products: countProductIssues(withStock),
      debtorCount: debtors.length,
      debtTotal: debtors.reduce((sum, c) => sum + Number(c.balance), 0),
    };
  } catch (e) {
    console.error("getBusinessAlerts", e);
    return null;
  }
}
