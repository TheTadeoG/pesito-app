import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getBranchContext } from "@/lib/branches";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { isOrgAdmin } from "@/lib/roles";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isOrderOverdue, loadPendingOrders, pendingByProduct } from "@/lib/restock-orders";
import { Card, CardContent } from "@/components/ui/card";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import {
  computePriceSuggestions,
  computeRestock,
  formatQty,
  loadInsightsBase,
  loadPriceHistory,
  restockOrderText,
  restockQtyLabel,
  DEFAULT_RESTOCK_SETTINGS,
  type RestockRow,
  type RestockSettings,
} from "@/lib/product-insights";
import { PriceSuggestions } from "@/app/(dashboard)/recomendaciones/price-suggestions";
import { RestockSettingsPanel } from "@/app/(dashboard)/recomendaciones/restock-settings";
import { OrderPlacedButton, PendingOrderCard } from "@/app/(dashboard)/recomendaciones/restock-orders";

const urgencyStyle: Record<RestockRow["urgency"], { label: string; className: string }> = {
  "sin-stock": { label: "Sin stock", className: "bg-danger-bg text-danger" },
  urgente: { label: "Urgente", className: "bg-amber-500/15 text-amber-600" },
  pronto: { label: "Pronto", className: "bg-muted text-muted-foreground" },
};

function whatsappOrderLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

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
            <Card key={group.supplierId ?? "sin"}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{group.supplierName}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.estimatedCost > 0
                        ? `${group.rows.length} productos · pedido estimado ${formatCurrency(group.estimatedCost)}`
                        : `${group.rows.length} productos`}
                      {group.leadDays !== null && ` · entrega en ${group.leadDays} día${group.leadDays === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {group.supplierId && (
                    <div className="flex flex-wrap items-center gap-2">
                    <OrderPlacedButton
                      supplierId={group.supplierId}
                      items={group.rows.map((r) => ({
                        productId: r.product.id,
                        name: r.product.name,
                        quantity: r.suggestedQty,
                      }))}
                    />
                    <a
                      href={whatsappOrderLink(restockOrderText(organization.name, group))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Armar pedido
                    </a>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {group.rows.slice(0, 60).map((r) => (
                    <div key={r.product.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{r.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {`Stock ${formatQty(Math.max(0, r.product.stock), r.product.unit)}`}
                          {r.daysLeft !== null ? ` · alcanza ${Math.floor(r.daysLeft)} días` : " · sin ventas en el período"}
                        </p>
                        {r.onOrder > 0 && (
                          <p className="text-xs font-medium text-primary">
                            {`Ya pedido: ${formatQty(r.onOrder, r.product.unit)} en camino. Esto es lo que falta además.`}
                          </p>
                        )}
                        {r.late && (
                          <p className="text-xs font-medium text-danger">
                            Se acaba antes de que llegue un pedido: pedilo hoy.
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${urgencyStyle[r.urgency].className}`}
                      >
                        {urgencyStyle[r.urgency].label}
                      </span>
                      <p className="min-w-24 max-w-[16rem] text-right text-sm font-semibold text-foreground">
                        {`Comprar ${restockQtyLabel(r)}`}
                      </p>
                    </div>
                  ))}
                </div>
                {group.rows.length > 60 && (
                  <p className="text-xs text-muted-foreground">Mostramos los 60 más urgentes de este proveedor.</p>
                )}
              </CardContent>
            </Card>
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
