import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { withBranchStock } from "@/lib/branches";

export interface CatalogProduct {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  price: number;
  stock: number;
  min_stock: number;
  unit: string;
  image_url: string | null;
}

// Catálogo completo del POS desde el servidor (stock de la sucursal de la caja).
// Lo usa la página la primera vez que un equipo abre el POS (después el
// navegador guarda su copia) y el respaldo si falla pos_catalog (0064).
export async function fetchCatalogForPos(
  supabase: SupabaseClient<Database>,
  orgId: string,
  branchId: string | null
): Promise<CatalogProduct[]> {
  const all = await fetchAll((from, to) =>
    supabase
      .from("products")
      .select("id, name, barcode, sku, price, stock, min_stock, unit, image_url")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("name")
      .order("id")
      .range(from, to)
  );
  const withStock = await withBranchStock(
    supabase,
    branchId ? { id: branchId, name: "", is_main: false } : null,
    all
  );
  return withStock.map((p) => ({
    ...p,
    price: Number(p.price),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
  }));
}
