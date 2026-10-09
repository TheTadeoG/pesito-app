import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getBranchContext, withBranchStock } from "@/lib/branches";
import { isOrgAdmin } from "@/lib/roles";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan, limitsFor, planForLimit } from "@/lib/plan-access";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import {
  computeIdleStock,
  computeStockCover,
  insightsBaseFrom,
  parseSalesStats,
  type InsightProduct,
} from "@/lib/product-insights";
import { IDLE_DEFAULT_DAYS } from "@/lib/idle-days";
import { parseStockFilterState } from "@/lib/stock-rows";
import { TransferButton } from "@/app/(dashboard)/productos/transfer-dialog";
import { ProductosClient } from "@/app/(dashboard)/productos/productos-client";
import { StockTab } from "@/app/(dashboard)/productos/stock-tab";
import { MarcasTab } from "@/app/(dashboard)/productos/marcas-tab";
import { CatalogTabs, type CatalogTab } from "@/app/(dashboard)/productos/catalog-tabs";

function parseTab(value: string | undefined): CatalogTab {
  return value === "stock" || value === "marcas" ? value : "productos";
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; producto?: string; marca?: string; estado?: string }>;
}) {
  const { tab: tabParam, producto, marca, estado } = await searchParams;
  const tab = parseTab(tabParam);
  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const { current: branch, branches } = await getBranchContext();
  const subscription = await getSubscription(supabase, organization.id);
  // Pestaña Stock (mínimos, faltantes, reposición y movimientos): Plan Esencial.
  const stockLocked = !canUse(subscription, "stockManagement");

  // Los productos se usan en las tres pestañas (tabla, stock bajo y conteo
  // por marca), así que se traen siempre; el resto depende de la pestaña.
  const [allProducts, { data: brands }, { data: suppliers }, { data: movements }] =
    await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("products")
          .select("*")
          .eq("org_id", organization.id)
          .order("name")
          .order("id")
          .range(from, to)
      ),
      supabase.from("brands").select("*").eq("org_id", organization.id).order("name"),
      tab === "productos" || tab === "stock"
        ? supabase.from("suppliers").select("id, name").eq("org_id", organization.id).order("name")
        : Promise.resolve({ data: [] }),
      tab === "stock" && !stockLocked
        ? supabase
            .from("stock_movements")
            .select("id, product_id, type, quantity, reference, created_at")
            .eq("org_id", organization.id)
            // Con sucursales, los movimientos de la sucursal actual.
            .match(branch ? { branch_id: branch.id } : {})
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] }),
    ]);

  // Stock, stock bajo y valorización: de la sucursal en la que se está
  // trabajando.
  const products = await withBranchStock(supabase, branch, allProducts);
  const normalized = products.map((p) => ({
    ...p,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
  }));

  const activeProducts = normalized.filter((p) => p.active);
  // Se cuenta aunque el plan no tenga gestión de stock: el número en la
  // pestaña invita a verlo (la pestaña muestra con qué plan se desbloquea).
  const lowStockCount = activeProducts.filter((p) => p.stock <= p.min_stock).length;

  let content: React.ReactNode;
  if (tab === "stock" && stockLocked) {
    content = (
      <ProLockedCard
        title="Gestión de stock y reposición"
        plan={featureMinPlan.stockManagement}
        preview="list"
        description="Stock mínimo por producto, aviso de lo que se está acabando, lista para reponer e historial de cada movimiento."
      />
    );
  } else if (tab === "stock") {
    // Sin filtrar por activo: un movimiento puede referenciar un producto
    // ya desactivado, y lo necesitamos igual para mostrar/filtrar por SKU.
    const productById = new Map(normalized.map((p) => [p.id, p]));
    const normalizedMovements = (movements ?? []).map((m) => {
      const product = productById.get(m.product_id);
      return {
        id: m.id,
        product_id: m.product_id,
        type: m.type,
        quantity: Number(m.quantity),
        reference: m.reference,
        created_at: m.created_at,
        product_name: product?.name ?? "Producto eliminado",
        product_sku: product?.sku ?? null,
        product_barcode: product?.barcode ?? null,
      };
    });
    const focusedProduct = producto ? productById.get(producto) : undefined;

    // Plan IA: cuántos días alcanza cada producto (ventas de los últimos 30 días) y la plata
    // parada en lo que no se vendió en los últimos 30 días (se cambia en la tarjeta). Sin el plan, la base
    // no devuelve ventas por producto (product_sales_stats pide Plan IA): se ofrece desbloquearlo.
    const insightsOn = canUse(subscription, "lowRotation");
    let insights: {
      cover: Record<string, number | null>;
      slow: { id: string; name: string; capital: number }[];
      idleDays: number;
    } | null = null;
    if (insightsOn) {
      try {
        // Con el período por defecto igual a los 30 días de la cobertura, es una sola consulta.
        const periods = Array.from(new Set([30, IDLE_DEFAULT_DAYS]));
        const results = await Promise.all(
          periods.map((days) =>
            supabase.rpc("product_sales_stats", {
              p_org_id: organization.id,
              p_days: days,
              p_branch_id: branch?.id ?? null,
            })
          )
        );
        const stats30 = results[periods.indexOf(30)];
        const statsIdle = results[periods.indexOf(IDLE_DEFAULT_DAYS)];
        if (!stats30.error && !statsIdle.error) {
          const insightProducts: InsightProduct[] = activeProducts.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            barcode: p.barcode,
            unit: p.unit,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            min_stock: p.min_stock,
            default_supplier_id: p.default_supplier_id,
            pack_size: p.pack_size ?? null,
            created_at: p.created_at,
          }));
          const cover = computeStockCover(insightsBaseFrom(insightProducts, parseSalesStats(stats30.data)), 30);
          const slow = computeIdleStock(insightProducts, parseSalesStats(statsIdle.data), IDLE_DEFAULT_DAYS);
          insights = {
            cover: Object.fromEntries(cover),
            slow,
            idleDays: IDLE_DEFAULT_DAYS,
          };
        }
      } catch {
        insights = null;
      }
    }

    content = (
      <StockTab
        key={focusedProduct?.id ?? "all"}
        products={activeProducts}
        movements={normalizedMovements}
        insights={insights}
        insightsLockedPlan={insightsOn ? null : featureMinPlan.lowRotation}
        orgId={organization.id}
        brands={brands ?? []}
        barcodeLocked={!canUse(subscription, "barcodeLabels")}
        suppliers={suppliers ?? []}
        focusedProduct={
          focusedProduct ? { id: focusedProduct.id, name: focusedProduct.name } : null
        }
      />
    );
  } else if (tab === "marcas") {
    const productCountByBrand: Record<string, number> = {};
    for (const p of normalized) {
      if (p.brand) productCountByBrand[p.brand] = (productCountByBrand[p.brand] ?? 0) + 1;
    }
    content = <MarcasTab brands={brands ?? []} productCountByBrand={productCountByBrand} />;
  } else {
    content = (
      <ProductosClient
        key={`${marca ?? "all"}|${estado ?? ""}`}
        products={normalized}
        brands={brands ?? []}
        suppliers={suppliers ?? []}
        initialBrand={marca ?? null}
        orgId={organization.id}
        bulkLocked={!canUse(subscription, "bulkPriceChanges")}
        revertLocked={!canUse(subscription, "priceRevert")}
        productUsage={{
          used: activeProducts.length,
          limit: limitsFor(subscription).products,
          nextPlan: planForLimit("products", limitsFor(subscription).products + 1),
        }}
        stockAlertsLocked={stockLocked}
        importLocked={!canUse(subscription, "productImport")}
        labelsLocked={!canUse(subscription, "barcodeLabels")}
        canManageCatalog={isOrgAdmin(membership.role)}
        restockLocked={!canUse(subscription, "restockRecommendations")}
        initialStockState={parseStockFilterState(estado)}
        idleAllowed={canUse(subscription, "lowRotation")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {branch && branches.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Stock de <span className="font-medium text-foreground">{branch.name}</span>. Para ver
            otra sucursal, cambiala desde el menú.
          </p>
          {isOrgAdmin(membership.role) && (
            <TransferButton
              products={activeProducts
                .filter((p) => p.stock > 0)
                .map(({ id, name, barcode, sku, stock, unit }) => ({ id, name, barcode, sku, stock, unit }))}
              branches={branches}
              currentBranchId={branch.id}
            />
          )}
        </div>
      )}
      <CatalogTabs active={tab} lowStockCount={lowStockCount} />
      {content}
    </div>
  );
}
