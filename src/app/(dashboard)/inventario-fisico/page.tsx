import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getBranchContext, withBranchStock } from "@/lib/branches";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { isOrgAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { CountClient, type CountItem, type CountProduct } from "@/app/(dashboard)/inventario-fisico/count-client";
import { StartCard, type PastCount } from "@/app/(dashboard)/inventario-fisico/start-card";

export default async function InventarioFisicoPage() {
  const { organization, membership } = await requireOrgContext();

  if (!isOrgAdmin(membership.role)) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sólo el dueño o un administrador pueden hacer un inventario físico.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "physicalInventory")) {
    return (
      <ProLockedCard
        title="Inventario físico"
        plan={featureMinPlan.physicalInventory}
        preview="list"
        description="Contá tu mercadería (escaneando o a mano), mirá las diferencias contra el sistema y ajustá todo el stock de una vez."
      />
    );
  }

  const { current: branch, branches } = await getBranchContext();
  if (!branch) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">No encontramos la sucursal. Recargá la página.</CardContent>
      </Card>
    );
  }

  const orgId = organization.id;
  const { data: open } = await supabase
    .from("inventory_counts")
    .select("id, name, scope_brand, scope_supplier_id, created_at")
    .eq("org_id", orgId)
    .eq("branch_id", branch.id)
    .eq("status", "abierto")
    .maybeSingle();

  if (!open) {
    const [{ data: brands }, { data: suppliers }, { data: past }] = await Promise.all([
      supabase.from("brands").select("name").eq("org_id", orgId).order("name"),
      supabase.from("suppliers").select("id, name").eq("org_id", orgId).order("name"),
      supabase
        .from("inventory_counts")
        .select("id, name, branch_id, applied_at, adjusted_count, units_plus, units_minus")
        .eq("org_id", orgId)
        .eq("status", "aplicado")
        .order("applied_at", { ascending: false })
        .limit(15),
    ]);
    const branchNames = new Map(branches.map((b) => [b.id, b.name]));
    const history: PastCount[] = (past ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      branch: branches.length > 1 ? branchNames.get(c.branch_id) ?? null : null,
      appliedAt: c.applied_at,
      adjusted: c.adjusted_count ?? 0,
      plus: Number(c.units_plus ?? 0),
      minus: Number(c.units_minus ?? 0),
    }));
    return (
      <StartCard
        branchName={branches.length > 1 ? branch.name : null}
        brands={(brands ?? []).map((b) => b.name)}
        suppliers={suppliers ?? []}
        history={history}
      />
    );
  }

  const [allProducts, itemRows] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, name, sku, barcode, brand, default_supplier_id, unit, stock, active")
        .eq("org_id", orgId)
        .eq("active", true)
        .order("name")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase.from("inventory_count_items").select("product_id, counted, expected").eq("count_id", open.id).order("id").range(from, to)
    ),
  ]);

  const inScope = allProducts.filter(
    (p) => (!open.scope_brand || p.brand === open.scope_brand) && (!open.scope_supplier_id || p.default_supplier_id === open.scope_supplier_id)
  );
  const withStock = await withBranchStock(supabase, branch, inScope);
  const products: CountProduct[] = withStock.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    unit: p.unit,
    stock: Number(p.stock),
  }));
  const items: CountItem[] = itemRows.map((i) => ({ productId: i.product_id, counted: Number(i.counted), expected: Number(i.expected) }));

  const scope = open.scope_brand ? `Marca: ${open.scope_brand}` : open.scope_supplier_id ? "Un proveedor" : "Todos los productos";
  return (
    <CountClient
      countId={open.id}
      name={open.name}
      scope={scope}
      branchName={branches.length > 1 ? branch.name : null}
      products={products}
      initialItems={items}
    />
  );
}
