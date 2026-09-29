import Link from "next/link";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getBranchContext } from "@/lib/branches";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { isOrgAdmin } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { isOrderOverdue, loadPendingOrders, pendingByProduct } from "@/lib/restock-orders";
import { Card, CardContent } from "@/components/ui/card";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import {
  computePriceSuggestions,
  computeRestock,
  formatQty,
  loadInsightsBase,
  loadPriceHistory,
  DEFAULT_RESTOCK_SETTINGS,
  type RestockSettings,
} from "@/lib/product-insights";
import { PriceSuggestions } from "@/app/(dashboard)/recomendaciones/price-suggestions";
import { RestockSettingsPanel } from "@/app/(dashboard)/recomendaciones/restock-settings";
import { PendingOrderCard } from "@/app/(dashboard)/recomendaciones/restock-orders";
import { SupplierRestockCard } from "@/app/(dashboard)/recomendaciones/supplier-restock-card";
import { RestockSummary, SupplierSpendChart } from "@/app/(dashboard)/recomendaciones/restock-visuals";

export default async function RecomendacionesPage() {
  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  const restockOn = canUse(subscription, "restockRecommendations");
  const pricesOn = canUse(subscription, "priceSuggestions");

  if (!restockOn && !pricesOn) {
    return (
      <div className="space-y-4">
        <ProLockedCard
          title="Recomendaciones de reposición"
          plan={featureMinPlan.restockRecommendations}
          preview="list"
          description="Qué comprar, cuánto y a qué proveedor, según lo que vendés. Con el pedido listo para mandar por WhatsApp."
        />
        <ProLockedCard
          title="Sugerencia de precios"
          plan={featureMinPlan.priceSuggestions}
          preview="list"
          description="Te avisamos qué precios actualizar cuando sube el costo o el margen queda bajo."
        />
      </div>
    );
  }

  const { current: branch } = await getBranchContext();
  // Ajustes del negocio (0052); sin la migración valen los de siempre.
  const settings: RestockSettings = {
    targetDays: organization.restock_target_days ?? DEFAULT_RESTOCK_SETTINGS.targetDays,
    windowDays: organization.restock_window_days ?? DEFAULT_RESTOCK_SETTINGS.windowDays,
    safetyDays: organization.restock_safety_days ?? DEFAULT_RESTOCK_SETTINGS.safetyDays,
  };
  const base = await loadInsightsBase(supabase, organization.id, branch, settings.windowDays);

  // Pedidos en camino (0053): lo ya pedido no se vuelve a sugerir.
  const pendingOrders = restockOn ? await loadPendingOrders(supabase, organization.id) : [];
  base.onOrder = pendingByProduct(pendingOrders);

  const groups = restockOn ? computeRestock(base, settings) : [];
  const suggestions = pricesOn
    ? computePriceSuggestions(base, await loadPriceHistory(supabase, organization.id))
    : [];

  const restockCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const allRows = groups.flatMap((g) => g.rows);
  const spendRows = groups
    .filter((g) => g.supplierId && g.estimatedCost > 0)
    .map((g) => ({ name: g.supplierName, cost: g.estimatedCost }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Qué comprar</h2>
          <p className="text-sm text-muted-foreground">
            {`Calculado con lo que vendiste en los últimos ${settings.windowDays} días, para tener stock para ${settings.targetDays} días${settings.safetyDays > 0 ? ` más ${settings.safetyDays} de colchón` : ""}. Nunca menos que el stock mínimo de cada producto.`}
          </p>
        </div>
        {restockOn && (
          <RestockSettingsPanel settings={settings} canEdit={isOrgAdmin(membership.role)} />
        )}
        {restockOn && restockCount > 0 && (
          <RestockSummary
            outOfStock={allRows.filter((r) => r.urgency === "sin-stock").length}
            urgent={allRows.filter((r) => r.urgency === "urgente").length}
            estimatedTotal={groups.reduce((n, g) => n + g.estimatedCost, 0)}
            inTransit={pendingOrders.length}
          />
        )}
        {restockOn && spendRows.length > 1 && <SupplierSpendChart rows={spendRows.slice(0, 8)} />}
        {pendingOrders.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {`Pedidos en camino (${pendingOrders.length})`}
            </p>
            {pendingOrders.map((order) => (
              <PendingOrderCard
                key={order.id}
                order={{
                  id: order.id,
                  supplierName: base.supplierNames.get(order.supplierId) ?? "Proveedor",
                  createdLabel: formatDate(order.createdAt),
                  expectedLabel: order.expectedAt ? formatDate(order.expectedAt) : null,
                  overdue: isOrderOverdue(order),
                  items: order.items
                    .filter((i) => i.quantity - i.received > 0)
                    .map((i) => {
                      const unit = base.products.find((p) => p.id === i.productId)?.unit ?? "u";
                      return { name: i.name, remaining: formatQty(i.quantity - i.received, unit) };
                    }),
                }}
              />
            ))}
            <p className="text-xs text-muted-foreground">
              Se cierran solos cuando cargás una compra a ese proveedor. Lo que ya viene en camino no se
              vuelve a sugerir abajo.
            </p>
          </div>
        )}
        {!restockOn ? (
          <ProLockedCard
            title="Recomendaciones de reposición"
            plan={featureMinPlan.restockRecommendations}
            preview="list"
            description="Qué comprar, cuánto y a qué proveedor, con el pedido listo para WhatsApp."
          />
        ) : restockCount === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Por ahora no hace falta reponer nada: el stock alcanza para lo que venís vendiendo.
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <SupplierRestockCard
              key={group.supplierId ?? "sin"}
              orgName={organization.name}
              targetDays={settings.targetDays}
              group={{
                key: group.supplierId ?? "sin",
                supplierId: group.supplierId,
                supplierName: group.supplierName,
                leadDays: group.leadDays,
                minOrder: group.minOrder,
                phone: group.supplierId ? base.supplierContacts.get(group.supplierId)?.phone ?? null : null,
                email: group.supplierId ? base.supplierContacts.get(group.supplierId)?.email ?? null : null,
                rows: group.rows.map((r) => ({
                  id: r.product.id,
                  name: r.product.name,
                  brand: r.product.brand,
                  stockLabel: formatQty(Math.max(0, r.product.stock), r.product.unit),
                  daysLeft: r.daysLeft,
                  urgency: r.urgency,
                  late: r.late,
                  lowHistory: r.lowHistory,
                  onOrderLabel: r.onOrder > 0 ? formatQty(r.onOrder, r.product.unit) : null,
                  rateLabel: r.perDay > 0 ? `${formatQty(r.perDay, r.product.unit)} por día` : null,
                  unit: r.product.unit,
                  stock: r.product.stock,
                  minStock: r.product.min_stock,
                  packSize: r.packSize,
                  suggestedAmount: r.packs ?? r.suggestedQty,
                  unitCost: r.product.cost !== null && r.product.cost > 0 ? r.product.cost : null,
                })),
              }}
            />
          ))
        )}
        {restockOn && groups.some((g) => !g.supplierId) && (
          <p className="text-xs text-muted-foreground">
            Asignale un proveedor habitual a tus productos (en <Link href="/productos" className="font-medium text-primary hover:underline">Productos</Link>) para armar el pedido de cada uno.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Precios para revisar</h2>
          <p className="text-sm text-muted-foreground">
            Productos cuyo costo subió después de su último cambio de precio, que vendés a pérdida o con menos de 10% de ganancia.
          </p>
        </div>
        {pricesOn ? (
          <PriceSuggestions
            canApply={isOrgAdmin(membership.role)}
            items={suggestions.slice(0, 300).map((s) => ({
              productId: s.product.id,
              name: s.product.name,
              brand: s.product.brand,
              price: s.product.price,
              cost: s.product.cost ?? 0,
              suggestedPrice: s.suggestedPrice,
              currentMarkup: s.currentMarkup,
              suggestedMarkup: s.suggestedMarkup,
              reason: s.reason,
              detail: s.detail,
            }))}
          />
        ) : (
          <ProLockedCard
            title="Sugerencia de precios"
            plan={featureMinPlan.priceSuggestions}
            preview="list"
            description="Te avisamos qué precios actualizar cuando sube el costo o el margen queda bajo."
          />
        )}
      </section>
    </div>
  );
}
