import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { PosScreen } from "@/app/(dashboard)/pos/pos-screen";
import { OpenCajaPrompt } from "@/app/(dashboard)/pos/open-caja-prompt";
import { getRecentSaleRows } from "@/app/(dashboard)/pos/recent-sales";
import { fetchAll } from "@/lib/supabase/fetch-all";

export default async function PosPage() {
  const { userId, organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: openRegister } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("org_id", organization.id)
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (!openRegister) {
    return <OpenCajaPrompt />;
  }

  // Catálogo y clientes completos: la búsqueda y el escaneo del carrito
  // filtran en el navegador, así que un producto o cliente que no viene
  // acá no se puede vender (antes se cortaba en 500 productos y 300
  // clientes por orden alfabético).
  const [products, customers, recentSales, { data: customPaymentMethods }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, name, barcode, sku, price, stock, min_stock, unit, image_url")
        .eq("org_id", organization.id)
        .eq("active", true)
        .order("name")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select("id, name, invoice_type, balance")
        .eq("org_id", organization.id)
        .order("name")
        .order("id")
        .range(from, to)
    ),
    getRecentSaleRows(supabase, openRegister.id),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
  ]);

  return (
    <PosScreen
      orgId={organization.id}
      cashRegisterId={openRegister.id}
      products={products.map((p) => ({ ...p, price: Number(p.price), stock: Number(p.stock) }))}
      customers={customers.map((c) => ({ ...c, balance: Number(c.balance) }))}
      autoInvoiceByPayment={organization.auto_invoice_by_payment}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
      recentSales={recentSales}
    />
  );
}
