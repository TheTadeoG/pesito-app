import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComprasClient } from "@/app/(dashboard)/compras/compras-client";
import { PurchasesList, type PurchaseRow } from "@/app/(dashboard)/compras/purchases-list";

const RECENT_PURCHASES_LIMIT = 20;

export default async function ComprasPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: products }, { data: suppliers }, { data: purchasesRaw }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, barcode, sku, cost, stock, unit, image_url")
      .eq("org_id", organization.id)
      .eq("active", true)
      .order("name")
      .limit(500),
    supabase.from("suppliers").select("id, name").eq("org_id", organization.id).order("name"),
    supabase
      .from("purchases")
      .select("id, total, notes, status, created_at, supplier_id")
      .eq("org_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(RECENT_PURCHASES_LIMIT),
  ]);

  const purchases = (purchasesRaw ?? []).map((p) => ({ ...p, total: Number(p.total) }));
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
  }));

  return (
    <div className="space-y-6">
      <ComprasClient
        orgId={organization.id}
        products={(products ?? []).map((p) => ({
          ...p,
          cost: p.cost === null ? null : Number(p.cost),
          stock: Number(p.stock),
        }))}
        suppliers={suppliers ?? []}
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
