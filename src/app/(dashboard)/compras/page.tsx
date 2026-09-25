import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComprasClient } from "@/app/(dashboard)/compras/compras-client";
import { PurchasesList, type PurchaseRow } from "@/app/(dashboard)/compras/purchases-list";

const RECENT_PURCHASES_LIMIT = 20;

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>;
}) {
  const { producto: preselectedProductId } = await searchParams;
  const { userId, organization } = await requireOrgContext();
  const supabase = await createClient();

  const [
    products,
    { data: suppliers },
    { data: purchasesRaw },
    { data: openRegister },
    { data: customPaymentMethods },
  ] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, name, barcode, sku, cost, stock, min_stock, unit, image_url")
        .eq("org_id", organization.id)
        .eq("active", true)
        .order("name")
        .order("id")
        .range(from, to)
    ),
    supabase
      .from("suppliers")
      .select("id, name, balance")
      .eq("org_id", organization.id)
      .order("name"),
    supabase
      .from("purchases")
      .select("id, total, notes, status, created_at, supplier_id, account_amount")
      .eq("org_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(RECENT_PURCHASES_LIMIT),
    supabase
      .from("cash_registers")
      .select("id")
      .eq("org_id", organization.id)
      .eq("user_id", userId)
      .eq("status", "abierta")
      .maybeSingle(),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
  ]);

  const purchases = (purchasesRaw ?? []).map((p) => ({
    ...p,
    total: Number(p.total),
    account_amount: Number(p.account_amount ?? 0),
  }));
  const purchaseIds = purchases.map((p) => p.id);

  const [{ data: itemsRaw }, { data: purchaseSuppliersRaw }] = await Promise.all([
    purchaseIds.length > 0
      ? supabase
          .from("purchase_items")
          .select("purchase_id, product_name, quantity")
          .in("purchase_id", purchaseIds)
      : Promise.resolve({ data: [] }),
    (() => {
      const supplierIds = Array.from(
        new Set(purchases.map((p) => p.supplier_id).filter((id): id is string => Boolean(id)))
      );
      return supplierIds.length > 0
        ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
        : Promise.resolve({ data: [] });
    })(),
  ]);

  const supplierNameById = new Map((purchaseSuppliersRaw ?? []).map((s) => [s.id, s.name]));
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
    supplierName: purchase.supplier_id
      ? supplierNameById.get(purchase.supplier_id) ?? "Proveedor eliminado"
      : "Sin proveedor",
    itemsSummary: (itemsByPurchase.get(purchase.id) ?? []).join(", ") || "Sin detalle",
    notes: purchase.notes,
    accountAmount: purchase.account_amount,
  }));

  return (
    <div className="space-y-6">
      <ComprasClient
        orgId={organization.id}
        products={products.map((p) => ({
          ...p,
          cost: p.cost === null ? null : Number(p.cost),
          stock: Number(p.stock),
        }))}
        suppliers={(suppliers ?? []).map((s) => ({ ...s, balance: Number(s.balance) }))}
        hasOpenCaja={Boolean(openRegister)}
        customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
        preselectedProductId={preselectedProductId ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compras recientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PurchasesList purchases={purchaseRows} />
        </CardContent>
      </Card>
    </div>
  );
}
