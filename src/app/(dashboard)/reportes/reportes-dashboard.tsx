"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CreditCard,
  DollarSign,
  Package,
  Receipt,
  Settings2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BarChart, type BarChartDatum } from "@/components/dashboard/bar-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { VentasList, type SaleRow } from "@/components/dashboard/ventas-list";
import { formatCurrency } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";

const WIDGETS = [
  { id: "tiles", label: "Indicadores principales" },
  { id: "revenue", label: "Ingresos por período" },
  { id: "payments", label: "Métodos de pago" },
  { id: "topQty", label: "Productos más vendidos" },
  { id: "topMargin", label: "Productos con más ganancia" },
  { id: "topCustomers", label: "Mejores clientes" },
  { id: "recentSales", label: "Últimas ventas" },
] as const;

type WidgetId = (typeof WIDGETS)[number]["id"];
const ALL_WIDGET_IDS = WIDGETS.map((w) => w.id);
const STORAGE_KEY = "pesito-reportes-widgets";

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
          {WIDGETS.map((widget) => (
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
