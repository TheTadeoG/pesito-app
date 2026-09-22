import Link from "next/link";
import { Lock } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { paymentLabels } from "@/lib/payment-labels";
import { VentasList, type SaleRow } from "@/components/dashboard/ventas-list";
import { PosClient } from "@/app/(dashboard)/pos/pos-client";

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
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Lock className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">
            Abrí tu caja para empezar a vender
          </h2>
          <p className="text-sm text-muted-foreground">
            Necesitás abrir la caja del día antes de poder cobrar ventas.
          </p>
          <Link href="/caja">
            <Button className="mt-2">Abrir Mi Caja</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const [{ data: products }, { data: customers }, { data: salesRaw }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, barcode, sku, price, stock, unit")
      .eq("org_id", organization.id)
      .eq("active", true)
      .order("name")
      .limit(500),
    supabase
      .from("customers")
      .select("id, name")
      .eq("org_id", organization.id)
      .order("name")
      .limit(300),
    supabase
      .from("sales")
      .select("id, total, payment_method, created_at, customer_id")
      .eq("cash_register_id", openRegister.id)
      .eq("status", "completada")
      .order("created_at", { ascending: false })
      .limit(RECENT_SALES_LIMIT),
  ]);

  const sales = (salesRaw ?? []).map((s) => ({ ...s, total: Number(s.total) }));
  const saleIds = sales.map((s) => s.id);

  const [{ data: itemsRaw }, { data: saleCustomersRaw }] = await Promise.all([
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
  ]);

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
    customerName: sale.customer_id
      ? customerNameById.get(sale.customer_id) ?? "Cliente eliminado"
      : "Consumidor Final",
    itemsSummary: (itemsBySale.get(sale.id) ?? []).join(", ") || "Sin detalle",
  }));

  return (
    <div className="space-y-6">
      <PosClient
        orgId={organization.id}
        cashRegisterId={openRegister.id}
        products={(products ?? []).map((p) => ({ ...p, price: Number(p.price), stock: Number(p.stock) }))}
        customers={customers ?? []}
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
