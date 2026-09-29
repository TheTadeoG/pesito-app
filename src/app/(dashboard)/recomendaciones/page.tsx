import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getBranchContext } from "@/lib/branches";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { isOrgAdmin } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { isOrderOverdue, loadPendingOrders, pendingByProduct } from "@/lib/restock-orders";
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
import { RestockFlow } from "@/app/(dashboard)/recomendaciones/restock-flow";
import { buildFlowGroups, buildSupplierOptions } from "@/lib/restock-view";

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

  const flowGroups = buildFlowGroups(groups, base, settings);

  // Lo que ya se pidió y no llegó (0053): pestaña "Esperando".
  const pendingViews = pendingOrders.map((order) => ({
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
  }));

  const pricesSection = (
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
  );

  // Sin recomendaciones de reposición (plan): se ofrece el plan y quedan los precios.
  if (!restockOn) {
    return (
      <div className="space-y-8">
        <ProLockedCard
          title="Recomendaciones de reposición"
          plan={featureMinPlan.restockRecommendations}
          preview="list"
          description="Qué comprar, cuánto y a qué proveedor, con el pedido listo para WhatsApp."
        />
        {pricesSection}
      </div>
    );
  }

  return (
    <RestockFlow
      groups={flowGroups}
      suppliers={buildSupplierOptions(base)}
      orgName={organization.name}
      pending={pendingViews}
      settingsBlock={<RestockSettingsPanel settings={settings} canEdit={isOrgAdmin(membership.role)} defaultOpen />}
      pricesBlock={pricesSection}
    />
  );
}
