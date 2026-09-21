import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "@/app/(dashboard)/inventario/inventario-client";

export default async function InventarioPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: products }, { data: movements }] = await Promise.all([
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
      .limit(30),
  ]);

  const normalizedProducts = (products ?? []).map((p) => ({
    ...p,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
  }));

  const productNameById = new Map(normalizedProducts.map((p) => [p.id, p.name]));

  const normalizedMovements = (movements ?? []).map((m) => ({
    id: m.id,
    type: m.type,
    quantity: Number(m.quantity),
    reference: m.reference,
    created_at: m.created_at,
    product_name: productNameById.get(m.product_id) ?? "Producto eliminado",
  }));

  return <InventarioClient products={normalizedProducts} movements={normalizedMovements} />;
}
