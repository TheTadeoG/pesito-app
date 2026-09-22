import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DollarSign, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
import { VentasList, type SaleRow } from "@/components/dashboard/ventas-list";
import { ClienteDetailClient } from "@/app/(dashboard)/clientes/[id]/cliente-detail-client";
import { getFiadoAmountsBySale } from "@/lib/sale-payments";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: customerRaw } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", organization.id)
    .eq("id", id)
    .maybeSingle();

  if (!customerRaw) notFound();

  const customer = { ...customerRaw, balance: Number(customerRaw.balance) };

  const { data: salesRaw } = await supabase
    .from("sales")
    .select("id, total, payment_method, invoice_type, created_at, status")
    .eq("org_id", organization.id)
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const sales = (salesRaw ?? []).map((s) => ({ ...s, total: Number(s.total) }));
  const completedSales = sales.filter((s) => s.status === "completada");
  const saleIds = sales.map((s) => s.id);

  const { data: itemsRaw } =
    saleIds.length > 0
      ? await supabase
          .from("sale_items")
          .select("sale_id, product_name, quantity")
          .in("sale_id", saleIds)
      : { data: [] };

  const itemsBySale = new Map<string, string[]>();
  for (const item of itemsRaw ?? []) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    const quantity = Number(item.quantity);
    list.push(quantity > 1 ? `${item.product_name} x${quantity}` : item.product_name);
    itemsBySale.set(item.sale_id, list);
  }

  const fiadoBySale = await getFiadoAmountsBySale(supabase, saleIds);

  const saleRows: SaleRow[] = sales.map((sale) => ({
    id: sale.id,
    created_at: sale.created_at,
    total: sale.total,
    payment_method: sale.payment_method,
    invoice_type: sale.invoice_type,
    customerName: customer.name,
    itemsSummary: (itemsBySale.get(sale.id) ?? []).join(", ") || "Sin detalle",
    fiadoAmount: fiadoBySale.get(sale.id) ?? 0,
  }));

  const totalComprado = completedSales.reduce((acc, s) => acc + s.total, 0);
  const cantidadCompras = completedSales.length;
  const ticketPromedio = cantidadCompras > 0 ? totalComprado / cantidadCompras : 0;
  const ultimaCompra = completedSales[0]?.created_at;

  const tiles = [
    { icon: DollarSign, label: "Total comprado", value: formatCurrency(totalComprado) },
    { icon: ShoppingBag, label: "Compras realizadas", value: String(cantidadCompras) },
    { icon: Receipt, label: "Ticket promedio", value: formatCurrency(ticketPromedio) },
    {
      icon: TrendingUp,
      label: "Última compra",
      value: ultimaCompra ? formatDateTime(ultimaCompra) : "Sin compras",
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Clientes
      </Link>

      <ClienteDetailClient customer={customer} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="flex items-center gap-3 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <tile.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
                <p className="truncate text-xl font-bold text-foreground">{tile.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de compras</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <VentasList
            sales={saleRows}
            paymentLabels={paymentLabels}
            emptyLabel="Todavía no le registraste ventas a este cliente."
          />
        </CardContent>
      </Card>
    </div>
  );
}
