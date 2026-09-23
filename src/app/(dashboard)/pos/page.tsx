import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { paymentLabels } from "@/lib/payment-labels";
import { VentasList, type SaleRow } from "@/components/dashboard/ventas-list";
import { PosClient } from "@/app/(dashboard)/pos/pos-client";
import { OpenCajaPrompt } from "@/app/(dashboard)/pos/open-caja-prompt";
import { getFiadoAmountsBySale } from "@/lib/sale-payments";

const RECENT_SALES_LIMIT = 8;

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

  // eslint-disable-next-line react-hooks/purity
  const topProductsSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: products },
    { data: customers },
    { data: salesRaw },
    { data: customPaymentMethods },
    { data: recentSalesForTop },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, barcode, sku, price, stock, min_stock, unit, image_url")
      .eq("org_id", organization.id)
      .eq("active", true)
      .order("name")
      .limit(500),
    supabase
      .from("customers")
      .select("id, name, invoice_type, balance")
      .eq("org_id", organization.id)
      .order("name")
      .limit(300),
    supabase
      .from("sales")
      .select("id, total, payment_method, invoice_type, created_at, customer_id")
      .eq("cash_register_id", openRegister.id)
      .eq("status", "completada")
      .order("created_at", { ascending: false })
      .limit(RECENT_SALES_LIMIT),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
    // Últimos 30 días de toda la org (no sólo esta caja): son los accesos
    // rápidos de "Más vendidos" del mostrador, no un reporte — con un mes
    // alcanza para reflejar lo que se vende seguido sin pesar la consulta.
    supabase
      .from("sales")
      .select("id")
      .eq("org_id", organization.id)
      .eq("status", "completada")
      .gte("created_at", topProductsSince)
      .limit(500),
  ]);

  const sales = (salesRaw ?? []).map((s) => ({ ...s, total: Number(s.total) }));
  const saleIds = sales.map((s) => s.id);

  const topSaleIds = (recentSalesForTop ?? []).map((s) => s.id);

  const [{ data: itemsRaw }, { data: saleCustomersRaw }, fiadoBySale, { data: topItemsRaw }] =
    await Promise.all([
      saleIds.length > 0
        ? supabase
            .from("sale_items")
            .select("sale_id, product_name, quantity")
            .in("sale_id", saleIds)
        : Promise.resolve({ data: [] }),
      (() => {
        const customerIds = Array.from(
          new Set(sales.map((s) => s.customer_id).filter((id): id is string => Boolean(id)))
        );
        return customerIds.length > 0
          ? supabase.from("customers").select("id, name").in("id", customerIds)
          : Promise.resolve({ data: [] });
      })(),
      getFiadoAmountsBySale(supabase, saleIds),
      topSaleIds.length > 0
        ? supabase.from("sale_items").select("product_id, quantity").in("sale_id", topSaleIds)
        : Promise.resolve({ data: [] }),
    ]);

  const qtyByProductId = new Map<string, number>();
  for (const item of topItemsRaw ?? []) {
    if (!item.product_id) continue;
    qtyByProductId.set(item.product_id, (qtyByProductId.get(item.product_id) ?? 0) + Number(item.quantity));
  }
  const topProductIds = Array.from(qtyByProductId.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const topProducts = topProductIds
    .map((id) => productById.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ ...p, price: Number(p.price), stock: Number(p.stock) }));

  const customerNameById = new Map((saleCustomersRaw ?? []).map((c) => [c.id, c.name]));
  const itemsBySale = new Map<string, string[]>();
  for (const item of itemsRaw ?? []) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    const quantity = Number(item.quantity);
    list.push(quantity > 1 ? `${item.product_name} x${quantity}` : item.product_name);
    itemsBySale.set(item.sale_id, list);
  }

  const saleRows: SaleRow[] = sales.map((sale) => ({
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

  return (
    <div className="space-y-6">
      <PosClient
        orgId={organization.id}
        cashRegisterId={openRegister.id}
        products={(products ?? []).map((p) => ({ ...p, price: Number(p.price), stock: Number(p.stock) }))}
        topProducts={topProducts}
        customers={(customers ?? []).map((c) => ({ ...c, balance: Number(c.balance) }))}
        autoInvoiceByPayment={organization.auto_invoice_by_payment}
        customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventas recientes de esta caja</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <VentasList
            sales={saleRows}
            paymentLabels={paymentLabels}
            emptyLabel="Todavía no cobraste ninguna venta en esta caja."
          />
        </CardContent>
      </Card>
    </div>
  );
}
