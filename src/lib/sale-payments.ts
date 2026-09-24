import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAllIn } from "@/lib/supabase/fetch-all";

// Cuánto de cada venta quedó cargado a fiado (relevante sobre todo para
// ventas "mixto", donde el total mezcla varios medios de pago y no se ve a
// simple vista cuánto de eso es deuda del cliente).
export async function getFiadoAmountsBySale(
  supabase: SupabaseClient<Database>,
  saleIds: string[]
): Promise<Map<string, number>> {
  if (saleIds.length === 0) return new Map();

  const data = await fetchAllIn(saleIds, (ids, from, to) =>
    supabase
      .from("sale_payments")
      .select("sale_id, amount")
      .in("sale_id", ids)
      .eq("method", "fiado")
      .order("id")
      .range(from, to)
  );

  const map = new Map<string, number>();
  for (const row of data) {
    map.set(row.sale_id, (map.get(row.sale_id) ?? 0) + Number(row.amount));
  }
  return map;
}
