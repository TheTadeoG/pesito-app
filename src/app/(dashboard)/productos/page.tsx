import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getBranchContext, withBranchStock } from "@/lib/branches";
import { isOrgAdmin } from "@/lib/roles";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan, limitsFor, planForLimit } from "@/lib/plan-access";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { parseStockFilterState } from "@/lib/stock-rows";
import { TransferButton } from "@/app/(dashboard)/productos/transfer-dialog";
import { ProductosClient } from "@/app/(dashboard)/productos/productos-client";
import { MovementsTab } from "@/app/(dashboard)/productos/movements-tab";
import { MarcasTab } from "@/app/(dashboard)/productos/marcas-tab";
import { CatalogTabs, type CatalogTab } from "@/app/(dashboard)/productos/catalog-tabs";
import { loadAlertSettings } from "@/lib/alert-settings";
import { thresholdsFrom } from "@/lib/product-alerts";
import { costRiseIds, lowMarginIds, staleCostIds } from "@/lib/catalog-alert-data";

// "stock" es el nombre viejo de la pestaña (links guardados): con un producto
// elegido era su historial, sin producto era la lista, que ahora es Productos.
function parseTab(value: string | undefined, producto: string | undefined): CatalogTab {
  if (value === "marcas" || value === "movimientos") return value;
  return value === "stock" && producto ? "movimientos" : "productos";
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; producto?: string; marca?: string; estado?: string; alertas?: string; v?: string }>;
}) {
  const { tab: tabParam, producto, marca, estado, alertas, v } = await searchParams;
  const tab = parseTab(tabParam, producto);
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
      tab === "productos"
        ? supabase.from("suppliers").select("id, name").eq("org_id", organization.id).order("name")
        : Promise.resolve({ data: [] }),
      tab === "movimientos" && !stockLocked
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

  let content: React.ReactNode;
  if (tab === "movimientos" && stockLocked) {
    content = (
      <ProLockedCard
        title="Movimientos de stock"
        plan={featureMinPlan.stockManagement}
        preview="list"
        description="El historial de cada movimiento de stock (ventas, compras, ajustes y transferencias), con el stock mínimo por producto y el aviso de lo que se está acabando."
      />
    );
  } else if (tab === "movimientos") {
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

    content = (
      <MovementsTab
        key={focusedProduct?.id ?? "all"}
        products={activeProducts}
        movements={normalizedMovements}
        focusedProduct={focusedProduct ? { id: focusedProduct.id, name: focusedProduct.name } : null}
      />
    );
  } else if (tab === "marcas") {
    const productCountByBrand: Record<string, number> = {};
    for (const p of normalized) {
      if (p.brand) productCountByBrand[p.brand] = (productCountByBrand[p.brand] ?? 0) + 1;
    }
    content = <MarcasTab brands={brands ?? []} productCountByBrand={productCountByBrand} />;
  } else {
    // Los avisos de margen y de costos llevan acá, a la lista de esos productos (la misma cuenta
    // que hace la campana: lib/catalog-alert-data.ts).
    const thresholds = thresholdsFrom(await loadAlertSettings(supabase, organization.id));
    let idFilter: { label: string; ids: string[] } | null = null;
    if (estado === "margen-bajo" && canUse(subscription, "marginAlerts")) {
      idFilter = { label: `Margen menor al ${thresholds.marginPercent}%`, ids: lowMarginIds(activeProducts, thresholds.marginPercent) };
    } else if (estado === "costo-viejo" && canUse(subscription, "marginAlerts")) {
      idFilter = {
        label: `Costo sin cambios hace más de ${thresholds.staleDays} días`,
        ids: await staleCostIds(supabase, organization.id, activeProducts, thresholds.staleDays),
      };
    } else if (estado === "precio-viejo" && canUse(subscription, "costRiseAlert")) {
      idFilter = { label: "Costo subió y el precio no", ids: await costRiseIds(supabase, organization.id, activeProducts) };
    }
    content = (
      <ProductosClient
        idFilter={idFilter}
        idleDays={thresholds.idleDays}
        // `v` lo pone un aviso que lleva a esta misma pantalla: cambia la clave y arranca de cero con ese aviso.
        key={`${marca ?? "all"}|${estado ?? ""}|${alertas ?? ""}|${v ?? ""}`}
        initialAlertsOpen={alertas === "1"}
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
      <CatalogTabs active={tab} />
      {content}
    </div>
  );
}
