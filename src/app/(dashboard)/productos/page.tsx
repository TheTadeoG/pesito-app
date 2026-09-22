import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
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
  searchParams: Promise<{ tab?: string; producto?: string; marca?: string }>;
}) {
  const { tab: tabParam, producto, marca } = await searchParams;
  const tab = parseTab(tabParam);
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  // Los productos se usan en las tres pestañas (tabla, stock bajo y conteo
  // por marca), así que se traen siempre; el resto depende de la pestaña.
  const [{ data: products }, { data: brands }, { data: suppliers }, { data: movements }] =
    await Promise.all([
      supabase.from("products").select("*").eq("org_id", organization.id).order("name"),
      tab === "stock"
        ? Promise.resolve({ data: [] })
        : supabase.from("brands").select("*").eq("org_id", organization.id).order("name"),
      tab === "productos"
        ? supabase.from("suppliers").select("id, name").eq("org_id", organization.id).order("name")
        : Promise.resolve({ data: [] }),
      tab === "stock"
        ? supabase
            .from("stock_movements")
            .select("id, product_id, type, quantity, reference, created_at")
            .eq("org_id", organization.id)
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] }),
    ]);

  const normalized = (products ?? []).map((p) => ({
    ...p,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
  }));

  const activeProducts = normalized.filter((p) => p.active);
  const lowStockCount = activeProducts.filter((p) => p.stock <= p.min_stock).length;

  let content: React.ReactNode;
  if (tab === "stock") {
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
      <StockTab
        key={focusedProduct?.id ?? "all"}
        products={activeProducts}
        movements={normalizedMovements}
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
        key={marca ?? "all"}
        products={normalized}
        brands={brands ?? []}
        suppliers={suppliers ?? []}
        initialBrand={marca ?? null}
      />
    );
  }

  return (
    <div className="space-y-4">
      <CatalogTabs active={tab} lowStockCount={lowStockCount} />
      {content}
    </div>
  );
}
