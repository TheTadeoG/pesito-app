import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import { getBranchContext, withBranchStock } from "@/lib/branches";
import { getSubscription } from "@/lib/subscription";
import { canUse } from "@/lib/plan-access";
import { loadPendingOrders } from "@/lib/restock-orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComprasClient } from "@/app/(dashboard)/compras/compras-client";
import { loadPurchaseDueDates } from "@/lib/supplier-overview";
import { PurchasesList, type PurchaseRow } from "@/app/(dashboard)/compras/purchases-list";

// Las últimas compras que se traen; la lista las muestra de a 25, 50, 100 o 200 por página.
const RECENT_PURCHASES_LIMIT = 200;

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string; pedido?: string }>;
}) {
  const { producto: preselectedProductId, pedido: restockOrderId } = await searchParams;
  const { userId, organization } = await requireOrgContext();
  const supabase = await createClient();

  const [
    allProducts,
    { data: suppliers },
    { data: purchasesRaw },
    { data: openRegister },
    { data: customPaymentMethods },
  ] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, name, barcode, sku, cost, price, stock, min_stock, unit, image_url")
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

  // Plazo de pago de cada proveedor (0057): si la columna todavía no existe la
  // consulta falla y los vencimientos no se precargan.
  const { data: termsRaw, error: termsError } = await supabase
    .from("suppliers")
    .select("id, payment_terms_days")
    .eq("org_id", organization.id);
  const termsById = new Map<string, number | null>(
    termsError ? [] : (termsRaw ?? []).map((s) => [s.id, s.payment_terms_days ?? null])
  );

  // Stock de la sucursal en la que está trabajando (donde va a entrar la
  // mercadería).
  const { current: branch } = await getBranchContext();
  const products = await withBranchStock(supabase, branch, allProducts);

  const purchases = (purchasesRaw ?? []).map((p) => ({
    ...p,
    total: Number(p.total),
    account_amount: Number(p.account_amount ?? 0),
  }));
  const purchaseIds = purchases.map((p) => p.id);
  const dueDates = await loadPurchaseDueDates(supabase, organization.id);

  // fetchAllIn: con 200 compras el .in() largo fallaba por la URL (ver fetch-all.ts).
  const supplierIds = Array.from(
    new Set(purchases.map((p) => p.supplier_id).filter((id): id is string => Boolean(id)))
  );
  const [itemsRaw, purchaseSuppliersRaw] = await Promise.all([
    fetchAllIn(purchaseIds, (ids, from, to) =>
      supabase
        .from("purchase_items")
        .select("id, purchase_id, product_name, quantity")
        .in("purchase_id", ids)
        .order("id")
        .range(from, to)
    ),
    fetchAllIn(supplierIds, (ids, from, to) =>
      supabase.from("suppliers").select("id, name").in("id", ids).order("id").range(from, to)
    ),
  ]);

  const supplierNameById = new Map(purchaseSuppliersRaw.map((s) => [s.id, s.name]));
  const itemsByPurchase = new Map<string, string[]>();
  for (const item of itemsRaw) {
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
    dueDate: dueDates.get(purchase.id) ?? null,
  }));

  // "Llegó → cargar la compra" desde Recomendaciones: la compra arranca con
  // los productos y cantidades que faltaban recibir de ese pedido.
  let prefill: { supplierId: string | null; lines: { productId: string; quantity: number }[] } | null = null;
  if (restockOrderId) {
    const order = (await loadPendingOrders(supabase, organization.id)).find((o) => o.id === restockOrderId);
    if (order) {
      prefill = {
        supplierId: order.supplierId,
        lines: order.items
          .map((i) => ({ productId: i.productId, quantity: i.quantity - i.received }))
          .filter((l) => l.quantity > 0),
      };
    }
  }

  return (
    <div className="space-y-6">
      <ComprasClient
        orgId={organization.id}
        products={products.map((p) => ({
          ...p,
          cost: p.cost === null ? null : Number(p.cost),
          price: Number(p.price),
          stock: Number(p.stock),
        }))}
        suppliers={(suppliers ?? []).map((s) => ({
          ...s,
          balance: Number(s.balance),
          payment_terms_days: termsById.get(s.id) ?? null,
        }))}
        hasOpenCaja={Boolean(openRegister)}
        customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
        supplierAccountsEnabled={canUse(
          await getSubscription(supabase, organization.id),
          "supplierAccounts"
        )}
        preselectedProductId={preselectedProductId ?? null}
        prefill={prefill}
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
