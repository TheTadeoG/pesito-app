import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "@/app/(dashboard)/inventario/inventario-client";

export default async function InventarioPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: products }, { data: movements }, { data: allProducts }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("org_id", organization.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("stock_movements")
      .select("id, product_id, type, quantity, reference, created_at")
      .eq("org_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(500),
    // Sin filtrar por activo: un movimiento puede referenciar un producto
    // ya desactivado, y lo necesitamos igual para mostrar/filtrar por SKU.
    supabase.from("products").select("id, name, sku, barcode").eq("org_id", organization.id),
  ]);

  const normalizedProducts = (products ?? []).map((p) => ({
    ...p,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
  }));

  const productById = new Map((allProducts ?? []).map((p) => [p.id, p]));

  const normalizedMovements = (movements ?? []).map((m) => {
    const product = productById.get(m.product_id);
    return {
      id: m.id,
      type: m.type,
      quantity: Number(m.quantity),
      reference: m.reference,
      created_at: m.created_at,
      product_name: product?.name ?? "Producto eliminado",
      product_sku: product?.sku ?? null,
      product_barcode: product?.barcode ?? null,
    };
  });

  return <InventarioClient products={normalizedProducts} movements={normalizedMovements} />;
}
