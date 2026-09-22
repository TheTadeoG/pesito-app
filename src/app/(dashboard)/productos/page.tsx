import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ProductosClient } from "@/app/(dashboard)/productos/productos-client";

export default async function ProductosPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: products }, { data: brands }] = await Promise.all([
    supabase.from("products").select("*").eq("org_id", organization.id).order("name"),
    supabase.from("brands").select("id, name").eq("org_id", organization.id).order("name"),
  ]);

  const normalized = (products ?? []).map((p) => ({
    ...p,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
  }));

  return <ProductosClient products={normalized} brands={brands ?? []} />;
}
