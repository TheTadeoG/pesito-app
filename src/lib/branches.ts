import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const BRANCH_COOKIE = "pesito-branch";

export interface Branch {
  id: string;
  name: string;
  is_main: boolean;
}

export interface BranchContext {
  branches: Branch[];
  // Sucursal en la que está trabajando esta persona: la asignada si es
  // vendedor; la que eligió en el menú (cookie) si es dueño/administrador.
  // null = la base todavía no tiene sucursales (migración 0043 sin aplicar):
  // todo funciona como antes, con el stock total del producto.
  current: Branch | null;
  // Dueños y administradores pueden cambiar de sucursal desde el menú.
  canSwitch: boolean;
}

/**
 * Sucursal actual de quien navega. Cacheada por request: layout, página y
 * acciones la piden por separado.
 */
export const getBranchContext = cache(async (): Promise<BranchContext> => {
  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("branches")
    .select("id, name, is_main")
    .eq("org_id", organization.id)
    .order("is_main", { ascending: false })
    .order("name");

  if (error || !data || data.length === 0) {
    return { branches: [], current: null, canSwitch: false };
  }

  const branches = data;
  const main = branches.find((b) => b.is_main) ?? branches[0];
  const isManager = membership.role === "owner" || membership.role === "admin";
  const assigned = branches.find((b) => b.id === membership.branch_id);

  let current = assigned ?? main;
  if (isManager) {
    const cookieStore = await cookies();
    const chosen = branches.find((b) => b.id === cookieStore.get(BRANCH_COOKIE)?.value);
    if (chosen) current = chosen;
  }

  return { branches, current, canSwitch: isManager && branches.length > 1 };
});

/** product_id -> stock en la sucursal (sin fila = 0). */
export async function getBranchStockMap(
  supabase: SupabaseClient<Database>,
  branchId: string
): Promise<Map<string, number>> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from("branch_stock")
      .select("product_id, stock")
      .eq("branch_id", branchId)
      .order("product_id")
      .range(from, to)
  );
  return new Map(rows.map((r) => [r.product_id, Number(r.stock)]));
}

/**
 * Reemplaza el stock total de cada producto por el de la sucursal. Sin
 * sucursal (0043 sin aplicar) deja el total, como antes.
 */
export async function withBranchStock<T extends { id: string; stock: number | string }>(
  supabase: SupabaseClient<Database>,
  branch: Branch | null,
  products: T[]
): Promise<T[]> {
  if (!branch) return products;
  const stockById = await getBranchStockMap(supabase, branch.id);
  return products.map((p) => ({ ...p, stock: stockById.get(p.id) ?? 0 }));
}
