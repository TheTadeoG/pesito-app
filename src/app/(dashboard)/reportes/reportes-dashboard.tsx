"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  DollarSign,
  Package,
  Receipt,
  Scale,
  Settings2,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BarChart, type BarChartDatum } from "@/components/dashboard/bar-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { VentasList, type SaleRow } from "@/components/dashboard/ventas-list";
import { PlanPill, ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { featureMinPlan } from "@/lib/plan-access";
import { cn, formatCurrency } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
import { reportesHref, type ReportPeriod } from "@/lib/report-periods";

const WIDGETS = [
  { id: "tiles", label: "Indicadores principales" },
  { id: "revenue", label: "Ingresos por período" },
  { id: "payments", label: "Métodos de pago" },
  { id: "topQty", label: "Productos más vendidos" },
  { id: "topMargin", label: "Productos con más ganancia" },
  { id: "fiadoDebtors", label: "Quién te debe (fiado)" },
  { id: "stockValue", label: "Stock valorizado" },
  { id: "topCustomers", label: "Mejores clientes" },
  { id: "sellers", label: "Ventas por vendedor" },
  { id: "cashDiff", label: "Diferencias de caja por vendedor" },
  { id: "periodComparison", label: "Comparación con el período anterior (Pro)" },
  { id: "lossProducts", label: "Productos vendidos a pérdida (Pro)" },
  { id: "recentSales", label: "Últimas ventas" },
] as const;

type WidgetId = (typeof WIDGETS)[number]["id"];
const ALL_WIDGET_IDS = WIDGETS.map((w) => w.id);
const STORAGE_KEY = "pesito-reportes-widgets";

export interface CashDiffRow {
  userLabel: string;
  cajasCerradas: number;
  faltante: number;
  sobrante: number;
}

export interface SellerRow {
  userId: string;
  userLabel: string;
  ventas: number;
  ingresos: number;
  ganancia: number;
  ticketPromedio: number;
  /** Parte de los ingresos del período (0 a 1). */
  share: number;
}

export interface FiadoDebtorRow {
  name: string;
  amount: number;
  /** null si nunca hizo un pago registrado. */
  daysSincePayment: number | null;
}

export interface LossProductRow {
  name: string;
  quantity: number;
  loss: number;
}

export interface ReportesData {
  periodLabel: string;
  tiles: {
    label: string;
    value: string;
    icon: "dollar" | "trending" | "chart" | "receipt";
    // Variación vs. el período anterior — sólo se completa con acceso Pro.
    deltaPct: number | null;
    /** El plan no incluye este indicador (ganancia sin reporte de ganancias). */
    locked?: boolean;
  }[];
  revenueChart: BarChartDatum[];
  revenueChartIsHourly: boolean;
  paymentBreakdown: { label: string; value: number }[];
  topByQuantity: { name: string; quantity: number }[];
  // null: el plan no incluye el reporte de ganancias.
  topByMargin: { name: string; margin: number }[] | null;
  topCustomers: { name: string; total: number }[];
  saleRows: SaleRow[];
  // Sólo se completa para dueños/administradores.
  cashDiffByUser: CashDiffRow[] | null;
  sellerRows: SellerRow[] | null;
  /** Vendedor por el que se filtra el reporte, o null si es de todos. */
  sellerLabel: string | null;
  fiadoDebtors: FiadoDebtorRow[];
  stockValue: { atCost: number; atPrice: number };
  hasProAccess: boolean;
  /** Dueño/administrador sin reportes por empleado en su plan: se muestran bloqueados. */
  teamLocked: boolean;
  // Los dos siguientes vienen en null cuando el negocio no tiene acceso Pro
  // (no vale la pena calcularlos en el servidor si no se van a mostrar).
  periodComparison: { ingresos: number; deltaPct: number | null } | null;
  lossProducts: LossProductRow[] | null;
}

const tileIcons = {
  dollar: DollarSign,
  trending: TrendingUp,
  chart: BarChart3,
  receipt: Receipt,
};

// Variación propia del "chip con flechita" típico de otros dashboards:
// mismo tono suave que ya usamos en toda la app para diferencias
// (sobrante/faltante de caja), con el ícono de tendencia en vez de una
// flecha diagonal genérica.
function TrendBadge({ deltaPct, size = "md" }: { deltaPct: number; size?: "sm" | "md" }) {
  const positive = deltaPct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold",
        positive ? "bg-success-bg text-success" : "bg-danger-bg text-danger",
        size === "sm" ? "gap-1 px-2 py-0.5 text-xs" : "gap-1.5 px-3 py-1 text-xl"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      {positive ? "+" : ""}
      {deltaPct.toFixed(0)}%
    </span>
  );
}

export function ReportesDashboard({
  data,
  period,
}: {
  data: ReportesData;
  period: ReportPeriod;
}) {
  const [visible, setVisible] = useState<Set<WidgetId>>(new Set(ALL_WIDGET_IDS));
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored: string[] = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisible(new Set(stored.filter((id): id is WidgetId => ALL_WIDGET_IDS.includes(id as WidgetId))));
      }
    } catch {
      // ignore malformed/blocked localStorage
    }
  }, []);

  function toggleWidget(id: WidgetId) {
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Fiado y stock son de todo el negocio: filtrando por vendedor no aplican.
  // "Ventas por vendedor" con uno solo elegido repetiría los indicadores.
  const hidden = new Set<WidgetId>();
  if (data.cashDiffByUser === null && !data.teamLocked) hidden.add("cashDiff");
  if ((data.sellerRows === null && !data.teamLocked) || data.sellerLabel !== null) hidden.add("sellers");
  if (data.sellerLabel !== null) {
    hidden.add("fiadoDebtors");
    hidden.add("stockValue");
  }
  const isVisible = (id: WidgetId) => visible.has(id) && !hidden.has(id);
  const availableWidgets = WIDGETS.filter((w) => !hidden.has(w.id));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowCustomize(true)}>
          <Settings2 className="h-4 w-4" />
          Personalizar
        </Button>
      </div>

      {isVisible("tiles") && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.tiles.map((tile) => {
            const Icon = tileIcons[tile.icon];
            return (
              <Card key={tile.label}>
                <CardContent className="flex items-center gap-3 py-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
                    <div className="flex items-center gap-2">
                      {tile.locked ? (
                        <Link
                          href="/suscribirse?plan=pro"
                          prefetch={false}
                          title="La ganancia estimada está en el Plan Pro"
                          className="flex items-center gap-2 hover:opacity-80"
                        >
                          {/* Monto de mentira, borroso: se ve que ahí hay un número. */}
                          <span aria-hidden className="select-none text-xl font-bold text-foreground blur-[5px]">
                            $ 000.000
                          </span>
                          <PlanPill plan="pro" />
                        </Link>
                      ) : (
                        <p className="truncate text-xl font-bold text-foreground">{tile.value}</p>
                      )}
                      {tile.deltaPct !== null && <TrendBadge deltaPct={tile.deltaPct} size="sm" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(isVisible("revenue") || isVisible("payments")) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {isVisible("revenue") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ingresos {data.revenueChartIsHourly ? "por hora" : "por día"} ({data.periodLabel})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.revenueChart.every((d) => d.value === 0) ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Sin datos en el período.
                  </p>
                ) : (
                  <BarChart
                    data={data.revenueChart}
                    // Con muchas barras (30 días, este mes) los montos de
                    // días consecutivos con ventas se pisan entre sí — a
                    // partir de ahí se apoya en el tooltip al pasar el
                    // mouse, igual que ya hace la vista por hora.
                    showValueLabels={!data.revenueChartIsHourly && data.revenueChart.length <= 15}
                    labelEvery={
                      data.revenueChartIsHourly
                        ? 3
                        : // Con muchos días (30 días, este mes) mostrar la
                          // etiqueta de cada uno amontona el eje — se
                          // espacían para que queden legibles.
                          data.revenueChart.length > 15
                          ? 5
                          : data.revenueChart.length > 7
                            ? 2
                            : 1
                    }
                  />
                )}
              </CardContent>
            </Card>
          )}

          {isVisible("payments") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">¿Cómo te pagan?</CardTitle>
              </CardHeader>
              <CardContent>
                {data.paymentBreakdown.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Sin operaciones.</p>
                ) : (
                  <DonutChart data={data.paymentBreakdown} formatValue={formatCurrency} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(isVisible("topQty") || isVisible("topMargin")) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {isVisible("topQty") && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Productos más vendidos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.topByQuantity.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">Sin ventas.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {data.topByQuantity.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between px-5 py-2.5 text-sm"
                      >
                        <span className="truncate text-foreground">{p.name}</span>
                        <Badge tone="accent">{p.quantity} vendidos</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isVisible("topMargin") && !data.topByMargin && (
            <ProLockedCard
              title="Productos que más ganancia dejan"
              preview="list"
              description="Con los reportes avanzados ves cuánto ganás, qué te deja más plata y qué vendés a pérdida."
            />
          )}
          {isVisible("topMargin") && data.topByMargin && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Productos que más ganancia dejan</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.topByMargin.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">Sin ventas.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {data.topByMargin.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between px-5 py-2.5 text-sm"
                      >
                        <span className="truncate text-foreground">{p.name}</span>
                        <span className="font-semibold text-success">
                          {formatCurrency(p.margin)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(isVisible("fiadoDebtors") || isVisible("stockValue")) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {isVisible("fiadoDebtors") && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Quién te debe</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.fiadoDebtors.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    Nadie te debe fiado ahora mismo.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {data.fiadoDebtors.map((d) => (
                      <div key={d.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate text-foreground">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.daysSincePayment === null
                              ? "Nunca registró un pago"
                              : d.daysSincePayment === 0
                                ? "Pagó hoy"
                                : `Hace ${d.daysSincePayment} día${d.daysSincePayment !== 1 ? "s" : ""} que no paga`}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-danger">
                          {formatCurrency(d.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isVisible("stockValue") && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Stock valorizado</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Al costo</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(data.stockValue.atCost)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A precio de venta</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(data.stockValue.atPrice)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isVisible("topCustomers") && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Mejores clientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topCustomers.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Sin ventas a clientes identificados en el período.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.topCustomers.map((c) => (
                  <div key={c.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="truncate text-foreground">{c.name}</span>
                    <span className="font-semibold text-foreground">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isVisible("sellers") && data.teamLocked && (
        <ProLockedCard
          title="Ventas por vendedor"
          plan={featureMinPlan.teamReports}
          preview="bars"
          description="Cuánto vende y cuánto gana cada empleado, y sus diferencias de caja."
        />
      )}

      {isVisible("sellers") && data.sellerRows && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Ventas por vendedor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.sellerRows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nadie vendió en este período.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.sellerRows.map((row) => (
                  <Link
                    key={row.userId}
                    href={reportesHref(period, row.userId)}
                    title={`Ver el reporte de ${row.userLabel}`}
                    className="block px-5 py-3 text-sm hover:bg-muted"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.userLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.ventas} venta{row.ventas !== 1 ? "s" : ""} · ticket promedio{" "}
                          {formatCurrency(row.ticketPromedio)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Ingresos</p>
                          <p className="font-semibold text-foreground">
                            {formatCurrency(row.ingresos)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ganancia est.</p>
                          <p
                            className={cn(
                              "font-semibold",
                              row.ganancia < 0 ? "text-danger" : "text-success"
                            )}
                          >
                            {formatCurrency(row.ganancia)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(row.share * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground">
                        {Math.round(row.share * 100)}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isVisible("cashDiff") && data.teamLocked && (
        <ProLockedCard title="Diferencias de caja por vendedor" plan={featureMinPlan.teamReports} preview="list" />
      )}

      {isVisible("cashDiff") && data.cashDiffByUser && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Diferencias de caja por vendedor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.cashDiffByUser.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nadie cerró una caja en este período.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.cashDiffByUser.map((row) => (
                  <div
                    key={row.userLabel}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{row.userLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.cajasCerradas} caja{row.cajasCerradas !== 1 ? "s" : ""} cerrada
                        {row.cajasCerradas !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Faltante</p>
                        <p
                          className={
                            row.faltante > 0
                              ? "font-semibold text-danger"
                              : "font-semibold text-muted-foreground"
                          }
                        >
                          {formatCurrency(row.faltante)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sobrante</p>
                        <p
                          className={
                            row.sobrante > 0
                              ? "font-semibold text-success"
                              : "font-semibold text-muted-foreground"
                          }
                        >
                          {formatCurrency(row.sobrante)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(isVisible("periodComparison") || isVisible("lossProducts")) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {isVisible("periodComparison") &&
            (data.periodComparison ? (
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Comparación con el período anterior</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.periodComparison.deltaPct === null ? (
                    <p className="text-sm text-muted-foreground">
                      No hubo ventas en el período anterior para comparar.
                    </p>
                  ) : (
                    <TrendBadge deltaPct={data.periodComparison.deltaPct} />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Período anterior: {formatCurrency(data.periodComparison.ingresos)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ProLockedCard title="Comparación con el período anterior" preview="comparison" />
            ))}

          {isVisible("lossProducts") &&
            (data.lossProducts ? (
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Productos vendidos a pérdida</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {data.lossProducts.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Ningún producto se vendió por debajo de su costo.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.lossProducts.map((p) => (
                        <div key={p.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                          <span className="truncate text-foreground">{p.name}</span>
                          <span className="font-semibold text-danger">
                            -{formatCurrency(p.loss)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <ProLockedCard title="Productos vendidos a pérdida" preview="list" />
            ))}
        </div>
      )}

      {isVisible("recentSales") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas ventas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <VentasList sales={data.saleRows} paymentLabels={paymentLabels} />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showCustomize}
        onClose={() => setShowCustomize(false)}
        title="Personalizar Reportes"
        description="Elegí qué secciones querés ver. Se guarda en este dispositivo."
      >
        <div className="space-y-2">
          {availableWidgets.map((widget) => (
            <label
              key={widget.id}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm"
            >
              <span className="text-foreground">{widget.label}</span>
              <input
                type="checkbox"
                checked={isVisible(widget.id)}
                onChange={() => toggleWidget(widget.id)}
                className="h-4 w-4 accent-primary"
              />
            </label>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
