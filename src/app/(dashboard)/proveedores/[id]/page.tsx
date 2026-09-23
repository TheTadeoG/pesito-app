import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DollarSign, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
import { CuentaCorriente, type CuentaCorrienteMovement } from "@/components/dashboard/cuenta-corriente";
import { PurchasesList, type PurchaseRow } from "@/app/(dashboard)/compras/purchases-list";
import { ProveedorDetailClient } from "@/app/(dashboard)/proveedores/[id]/proveedor-detail-client";

export default async function ProveedorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: supplierRaw } = await supabase
    .from("suppliers")
    .select("*")
    .eq("org_id", organization.id)
    .eq("id", id)
    .maybeSingle();

  if (!supplierRaw) notFound();

  const supplier = { ...supplierRaw, balance: Number(supplierRaw.balance) };

  const [{ data: purchasesRaw }, { data: paymentsRaw }, { data: customPaymentMethods }] =
    await Promise.all([
      supabase
        .from("purchases")
        .select("id, total, notes, status, created_at, account_amount")
        .eq("org_id", organization.id)
        .eq("supplier_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("supplier_payments")
        .select("id, amount, method, created_at")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_methods")
        .select("name")
        .eq("org_id", organization.id)
        .order("created_at"),
    ]);

  const purchases = (purchasesRaw ?? []).map((p) => ({
    ...p,
    total: Number(p.total),
    account_amount: Number(p.account_amount ?? 0),
  }));
  const completedPurchases = purchases.filter((p) => p.status === "completada");
  const purchaseIds = purchases.map((p) => p.id);

  const { data: itemsRaw } =
    purchaseIds.length > 0
      ? await supabase
          .from("purchase_items")
          .select("purchase_id, product_name, quantity")
          .in("purchase_id", purchaseIds)
      : { data: [] };

  const itemsByPurchase = new Map<string, string[]>();
  for (const item of itemsRaw ?? []) {
    const list = itemsByPurchase.get(item.purchase_id) ?? [];
    const quantity = Number(item.quantity);
    list.push(quantity > 1 ? `${item.product_name} x${quantity}` : item.product_name);
    itemsByPurchase.set(item.purchase_id, list);
  }

  const purchaseRows: PurchaseRow[] = purchases.map((purchase) => ({
    id: purchase.id,
    created_at: purchase.created_at,
    total: purchase.total,
    status: purchase.status,
    supplierName: supplier.name,
    itemsSummary: (itemsByPurchase.get(purchase.id) ?? []).join(", ") || "Sin detalle",
    notes: purchase.notes,
    accountAmount: purchase.account_amount,
  }));

  const payments = (paymentsRaw ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));

  const movements: CuentaCorrienteMovement[] = [
    ...completedPurchases
      .filter((p) => p.account_amount > 0)
      .map((p) => ({
        id: `purchase-${p.id}`,
        date: p.created_at,
        label: `Compra · ${formatCurrency(p.total)} total`,
        cargo: p.account_amount,
        pago: 0,
      })),
    ...payments.map((pay) => ({
      id: `payment-${pay.id}`,
      date: pay.created_at,
      label: `Pago · ${paymentLabels[pay.method] ?? pay.method}`,
      cargo: 0,
      pago: pay.amount,
    })),
  ];

  const totalComprado = completedPurchases.reduce((acc, p) => acc + p.total, 0);
  const cantidadCompras = completedPurchases.length;
  const ultimaCompra = completedPurchases[0]?.created_at;

  const tiles = [
    { icon: DollarSign, label: "Total comprado", value: formatCurrency(totalComprado) },
    { icon: ShoppingBag, label: "Compras realizadas", value: String(cantidadCompras) },
    {
      icon: TrendingUp,
      label: "Última compra",
      value: ultimaCompra ? formatDateTime(ultimaCompra) : "Sin compras",
    },
    { icon: Wallet, label: "Saldo actual", value: formatCurrency(supplier.balance) },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/proveedores"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Proveedores
      </Link>

      <ProveedorDetailClient
        supplier={supplier}
        customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
      />

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
          <CardTitle className="text-base">Cuenta corriente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CuentaCorriente
            movements={movements}
            emptyLabel="Todavía no hay compras a cuenta corriente ni pagos con este proveedor."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compras</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PurchasesList purchases={purchaseRows} />
        </CardContent>
      </Card>
    </div>
  );
}
