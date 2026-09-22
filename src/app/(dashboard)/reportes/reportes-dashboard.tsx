"use client";

import { useEffect, useState } from "react";
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
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { formatCurrency } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";

const WIDGETS = [
  { id: "tiles", label: "Indicadores principales" },
  { id: "revenue", label: "Ingresos por período" },
  { id: "payments", label: "Métodos de pago" },
  { id: "topQty", label: "Productos más vendidos" },
  { id: "topMargin", label: "Productos con más ganancia" },
  { id: "fiadoDebtors", label: "Quién te debe (fiado)" },
  { id: "stockValue", label: "Stock valorizado" },
  { id: "topCustomers", label: "Mejores clientes" },
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
  tiles: { label: string; value: string; icon: "dollar" | "trending" | "chart" | "receipt" }[];
  revenueChart: BarChartDatum[];
  revenueChartIsHourly: boolean;
  paymentBreakdown: { label: string; value: number }[];
  topByQuantity: { name: string; quantity: number }[];
  topByMargin: { name: string; margin: number }[];
  topCustomers: { name: string; total: number }[];
  saleRows: SaleRow[];
  // Sólo se completa para dueños/administradores.
  cashDiffByUser: CashDiffRow[] | null;
  fiadoDebtors: FiadoDebtorRow[];
  stockValue: { atCost: number; atPrice: number };
  hasProAccess: boolean;
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

export function ReportesDashboard({ data }: { data: ReportesData }) {
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

  const isVisible = (id: WidgetId) => visible.has(id);
  const availableWidgets = WIDGETS.filter((w) => w.id !== "cashDiff" || data.cashDiffByUser !== null);

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
                    <p className="truncate text-xl font-bold text-foreground">{tile.value}</p>
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
                    showValueLabels={!data.revenueChartIsHourly}
                    labelEvery={data.revenueChartIsHourly ? 3 : 1}
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

          {isVisible("topMargin") && (
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
                <CardContent className="space-y-1">
                  {data.periodComparison.deltaPct === null ? (
                    <p className="text-sm text-muted-foreground">
                      No hubo ventas en el período anterior para comparar.
                    </p>
                  ) : (
                    <p
                      className={`text-2xl font-bold ${
                        data.periodComparison.deltaPct >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {data.periodComparison.deltaPct >= 0 ? "+" : ""}
                      {data.periodComparison.deltaPct.toFixed(0)}%
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Período anterior: {formatCurrency(data.periodComparison.ingresos)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ProLockedCard title="Comparación con el período anterior" />
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
              <ProLockedCard title="Productos vendidos a pérdida" />
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
