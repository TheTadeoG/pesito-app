import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import { getSubscription } from "@/lib/subscription";
import { canUse } from "@/lib/plan-access";
import { ProveedoresClient, type SupplierRow } from "@/app/(dashboard)/proveedores/proveedores-client";

export default async function ProveedoresPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: suppliers }, { data: customPaymentMethods }, purchases, subscription] =
    await Promise.all([
      supabase.from("suppliers").select("*").eq("org_id", organization.id).order("name"),
      supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
      fetchAll((from, to) =>
        supabase
          .from("purchases")
          .select("id, supplier_id, total, created_at")
          .eq("org_id", organization.id)
          .eq("status", "completada")
          .not("supplier_id", "is", null)
          .order("id")
          .range(from, to)
      ),
      getSubscription(supabase, organization.id),
    ]);

  // Qué productos le compramos a cada uno (según las compras cargadas),
  // cuánto le compramos en total y cuándo fue la última compra.
  const items = await fetchAllIn(
    purchases.map((p) => p.id),
    (ids, from, to) =>
      supabase
        .from("purchase_items")
        .select("purchase_id, product_name")
        .in("purchase_id", ids)
        .order("id")
        .range(from, to)
  );
  const supplierByPurchase = new Map(purchases.map((p) => [p.id, p.supplier_id as string]));
  const products = new Map<string, Set<string>>();
  for (const item of items) {
    const supplierId = supplierByPurchase.get(item.purchase_id);
    if (!supplierId) continue;
    const set = products.get(supplierId) ?? new Set<string>();
    set.add(item.product_name);
    products.set(supplierId, set);
  }
  const totals = new Map<string, { total: number; last: string }>();
  for (const p of purchases) {
    const id = p.supplier_id as string;
    const current = totals.get(id) ?? { total: 0, last: p.created_at };
    current.total += Number(p.total);
    if (p.created_at > current.last) current.last = p.created_at;
    totals.set(id, current);
  }

  const rows: SupplierRow[] = (suppliers ?? []).map((s) => ({
    ...s,
    balance: Number(s.balance),
    products: Array.from(products.get(s.id) ?? []).sort((a, b) => a.localeCompare(b, "es")),
    totalPurchased: totals.get(s.id)?.total ?? 0,
    lastPurchaseAt: totals.get(s.id)?.last ?? null,
  }));

  return (
    <ProveedoresClient
      suppliers={rows}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
      accountsEnabled={canUse(subscription, "supplierAccounts")}
    />
  );
}
