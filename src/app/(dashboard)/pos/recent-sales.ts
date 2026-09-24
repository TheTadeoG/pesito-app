import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { SaleRow } from "@/components/dashboard/ventas-list";
import { getFiadoAmountsBySale } from "@/lib/sale-payments";

const RECENT_SALES_LIMIT = 8;

// "Ventas recientes de esta caja" del POS. Vive aparte de la página porque
// también la usa checkoutSale: después de cobrar se devuelve sólo esta
// lista (unos pocos KB) en vez de volver a renderizar el POS entero, que
// bajaba de nuevo todo el catálogo y los clientes en cada venta.
export async function getRecentSaleRows(
  supabase: SupabaseClient<Database>,
  cashRegisterId: string
): Promise<SaleRow[]> {
  const { data: salesRaw } = await supabase
    .from("sales")
    .select("id, total, payment_method, invoice_type, created_at, customer_id")
    .eq("cash_register_id", cashRegisterId)
    .eq("status", "completada")
    .order("created_at", { ascending: false })
    .limit(RECENT_SALES_LIMIT);

  const sales = (salesRaw ?? []).map((s) => ({ ...s, total: Number(s.total) }));
  if (sales.length === 0) return [];
  const saleIds = sales.map((s) => s.id);
  const customerIds = Array.from(
    new Set(sales.map((s) => s.customer_id).filter((id): id is string => Boolean(id)))
  );

  const [{ data: itemsRaw }, { data: saleCustomersRaw }, fiadoBySale] = await Promise.all([
    supabase.from("sale_items").select("sale_id, product_name, quantity").in("sale_id", saleIds),
    customerIds.length > 0
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    getFiadoAmountsBySale(supabase, saleIds),
  ]);

  const customerNameById = new Map((saleCustomersRaw ?? []).map((c) => [c.id, c.name]));
  const itemsBySale = new Map<string, string[]>();
  for (const item of itemsRaw ?? []) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    const quantity = Number(item.quantity);
    list.push(quantity > 1 ? `${item.product_name} x${quantity}` : item.product_name);
    itemsBySale.set(item.sale_id, list);
  }

  return sales.map((sale) => ({
    id: sale.id,
    created_at: sale.created_at,
    total: sale.total,
    payment_method: sale.payment_method,
    invoice_type: sale.invoice_type,
    customerName: sale.customer_id
      ? customerNameById.get(sale.customer_id) ?? "Cliente eliminado"
      : "Consumidor Final",
    itemsSummary: (itemsBySale.get(sale.id) ?? []).join(", ") || "Sin detalle",
    fiadoAmount: fiadoBySale.get(sale.id) ?? 0,
  }));
}
