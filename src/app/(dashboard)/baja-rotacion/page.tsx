import Link from "next/link";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getBranchContext } from "@/lib/branches";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { computeLowRotation, formatQty, loadInsightsBase } from "@/lib/product-insights";

const PERIODS = [60, 90, 180] as const;

export default async function BajaRotacionPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias } = await searchParams;
  const days = PERIODS.find((p) => String(p) === dias) ?? 90;

  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "lowRotation")) {
    return (
      <ProLockedCard
        title="Baja rotación"
        plan={featureMinPlan.lowRotation}
        preview="list"
        description="Los productos que hace tiempo no se venden o se venden muy de a poco, y cuánta plata tenés parada en ellos."
      />
    );
  }

  const { current: branch } = await getBranchContext();
  const base = await loadInsightsBase(supabase, organization.id, branch, days);
  const rows = computeLowRotation(base, days);
  const capital = rows.reduce((n, r) => n + (r.capital ?? 0), 0);
  const noSales = rows.filter((r) => r.kind === "sin-ventas").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {`Productos con stock que no se vendieron en los últimos ${days} días, o que se venden tan de a poco que el stock alcanza para más de 6 meses. No incluye productos cargados hace menos de ${days} días.`}
        </p>
        <div className="flex gap-1 rounded-xl border border-border p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/baja-rotacion?dias=${p}`}
              prefetch={false}
              className={`rounded-lg px-3 py-1 text-sm font-medium ${
                p === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {`${p} días`}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No encontramos productos parados: todo lo que tenés en stock se está vendiendo.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">Plata parada (a costo)</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(capital)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">Sin ventas en el período</p>
                <p className="text-2xl font-bold text-foreground">{noSales}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">Se venden muy de a poco</p>
                <p className="text-2xl font-bold text-foreground">{rows.length - noSales}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="divide-y divide-border py-2">
              {rows.slice(0, 200).map((r) => (
                <div key={r.product.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.kind === "sin-ventas"
                        ? r.daysSinceSale === null
                          ? "No se vendió en el último año"
                          : `Última venta hace ${r.daysSinceSale} días`
                        : `Vendiste ${formatQty(r.soldInPeriod, r.product.unit)} en ${days} días; el stock dura unos ${Math.round((r.coverDays ?? 0) / 30)} meses`}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {`Stock ${formatQty(r.product.stock, r.product.unit)}`}
                  </p>
                  <p className="w-28 text-right text-sm font-semibold text-foreground">
                    {r.capital === null ? "Sin costo" : formatCurrency(r.capital)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          {rows.length > 200 && (
            <p className="text-xs text-muted-foreground">Mostramos los 200 que más plata inmovilizan.</p>
          )}
        </>
      )}
    </div>
  );
}
