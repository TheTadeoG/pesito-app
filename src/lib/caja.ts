import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function computeCashOnHand(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string,
  openingAmount: number
): Promise<number> {
  const [{ data: sales }, { data: movements }] = await Promise.all([
    supabase
      .from("sales")
      .select("total")
      .eq("cash_register_id", cashRegisterId)
      .eq("payment_method", "efectivo")
      .eq("status", "completada"),
    supabase
      .from("cash_movements")
      .select("type, amount")
      .eq("cash_register_id", cashRegisterId),
  ]);

  const salesTotal = (sales ?? []).reduce((acc, sale) => acc + Number(sale.total), 0);
  const movementsNet = (movements ?? []).reduce(
    (acc, m) => acc + (m.type === "ingreso" ? Number(m.amount) : -Number(m.amount)),
    0
  );

  return openingAmount + salesTotal + movementsNet;
}
