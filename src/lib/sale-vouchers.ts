import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAllIn } from "@/lib/supabase/fetch-all";

/** Cómo se rotula en las listas una factura electrónica emitida: «Factura C» (y «prueba» si no vale fiscalmente). */
export function voucherBadge(voucherClass: string | null, environment: string): string {
  return `Factura${voucherClass ? ` ${voucherClass}` : ""}${environment === "test" ? " (prueba)" : ""}`;
}

/**
 * La factura electrónica autorizada de cada venta (si la tiene). Es lo que dicen las listas: antes mostraban
 * el «tipo de comprobante a pedir» guardado en la venta, que no es una factura emitida.
 */
export async function getInvoiceBadgesBySale(
  supabase: SupabaseClient<Database>,
  saleIds: readonly string[]
): Promise<Map<string, string>> {
  const badges = new Map<string, string>();
  if (saleIds.length === 0) return badges;
  try {
    const rows = await fetchAllIn(saleIds, (ids, from, to) =>
      supabase
        .from("arca_vouchers")
        .select("sale_id, voucher_class, environment")
        .in("sale_id", ids)
        .eq("kind", "invoice")
        .eq("status", "authorized")
        .order("id")
        .range(from, to)
    );
    for (const r of rows) if (r.sale_id) badges.set(r.sale_id, voucherBadge(r.voucher_class, r.environment));
  } catch {
    // Sin la tabla (migración 0080 sin aplicar) o sin permiso: las listas se ven igual, sin la etiqueta.
  }
  return badges;
}
