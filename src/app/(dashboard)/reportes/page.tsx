import { BarChart3, CreditCard, DollarSign, Package, Receipt, TrendingUp } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const PERIOD_DAYS = 30;

const paymentLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mixto: "Mixto",
  fiado: "Fiado",
};

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" }).format(date);
}

export default async function ReportesPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - PERIOD_DAYS);

  const { data: salesRaw } = await supabase
    .from("sales")
    .select("id, total, payment_method, created_at, customer_id")
    .eq("org_id", organization.id)
    .eq("status", "completada")
    .gte("created_at", periodStart.toISOString())
    .order("created_at", { ascending: false });

  const sales = (salesRaw ?? []).map((s) => ({ ...s, total: Number(s.total) }));
  const saleIds = sales.map((s) => s.id);

  const { data: itemsRaw } =
    saleIds.length > 0
      ? await supabase
          .from("sale_items")
          .select("sale_id, product_id, product_name, quantity, unit_price, subtotal")
          .in("sale_id", saleIds)
      : { data: [] };

  const items = (itemsRaw ?? []).map((i) => ({
    ...i,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    subtotal: Number(i.subtotal),
  }));

  const productIds = Array.from(
    new Set(items.map((i) => i.product_id).filter((id): id is string => Boolean(id)))
  );

  const { data: productsRaw } =
    productIds.length > 0
      ? await supabase.from("products").select("id, cost").in("id", productIds)
      : { data: [] };

  const costById = new Map((productsRaw ?? []).map((p) => [p.id, Number(p.cost ?? 0)]));

  const ingresos = sales.reduce((acc, s) => acc + s.total, 0);
  const totalVentas = sales.length;
  const ticketPromedio = totalVentas > 0 ? ingresos / totalVentas : 0;
  const costoTotal = items.reduce(
    (acc, i) => acc + i.quantity * (i.product_id ? costById.get(i.product_id) ?? 0 : 0),
    0
  );
  const gananciaEstimada = ingresos - costoTotal;

  const paymentTotals = new Map<string, number>();
  for (const sale of sales) {
    paymentTotals.set(sale.payment_method, (paymentTotals.get(sale.payment_method) ?? 0) + sale.total);
  }
  const paymentBreakdown = Array.from(paymentTotals.entries())
    .map(([method, total]) => ({ method, total, pct: ingresos > 0 ? (total / ingresos) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
  const topPaymentMethod = paymentBreakdown[0]?.method;

  const byProductQty = new Map<string, { name: string; quantity: number; margin: number }>();
  for (const item of items) {
    const key = item.product_id ?? item.product_name;
    const current = byProductQty.get(key) ?? { name: item.product_name, quantity: 0, margin: 0 };
    current.quantity += item.quantity;
    current.margin += item.subtotal - item.quantity * (item.product_id ? costById.get(item.product_id) ?? 0 : 0);
    byProductQty.set(key, current);
  }
  const topByQuantity = Array.from(byProductQty.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const topByMargin = Array.from(byProductQty.values())
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - i));
    return date;
  });
  const dailyTotals = days.map((date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const total = sales
      .filter((s) => {
        const created = new Date(s.created_at);
        return created >= date && created < next;
      })
      .reduce((acc, s) => acc + s.total, 0);
    return { date, total };
  });
  const maxDaily = Math.max(1, ...dailyTotals.map((d) => d.total));

  const tiles = [
    { icon: DollarSign, label: "Ingresos (30 días)", value: formatCurrency(ingresos) },
    { icon: TrendingUp, label: "Ganancia estimada", value: formatCurrency(gananciaEstimada) },
    { icon: BarChart3, label: "Total de ventas", value: String(totalVentas) },
    { icon: Receipt, label: "Ticket promedio", value: formatCurrency(ticketPromedio) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="flex items-center gap-3 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <tile.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
                <p className="truncate text-xl font-bold text-foreground">{tile.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos por día (últimos 7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {ingresos === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Sin datos en el período.
              </p>
            ) : (
              <div className="flex h-40 items-end justify-between gap-2">
                {dailyTotals.map((d) => (
                  <div key={d.date.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {d.total > 0 ? formatCurrency(d.total) : ""}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-primary/80"
                        style={{ height: `${Math.max(4, (d.total / maxDaily) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{dayLabel(d.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">¿Cómo te pagan?</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin operaciones.</p>
            ) : (
              <div className="space-y-3">
                {paymentBreakdown.map((p) => (
                  <div key={p.method}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {paymentLabels[p.method] ?? p.method}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(p.total)} · {p.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topByQuantity.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Sin ventas.</p>
            ) : (
              <div className="divide-y divide-border">
                {topByQuantity.map((p) => (
                  <div key={p.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="truncate text-foreground">{p.name}</span>
                    <Badge tone="accent">{p.quantity} vendidos</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Productos que más ganancia dejan</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topByMargin.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Sin ventas.</p>
            ) : (
              <div className="divide-y divide-border">
                {topByMargin.map((p) => (
                  <div key={p.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="truncate text-foreground">{p.name}</span>
                    <span className="font-semibold text-success">{formatCurrency(p.margin)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas ventas</CardTitle>
          {topPaymentMethod && (
            <span className="text-xs text-muted-foreground">
              Medio más usado: {paymentLabels[topPaymentMethod] ?? topPaymentMethod}
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {sales.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Todavía no registraste ventas.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {sales.slice(0, 10).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">{formatDateTime(sale.created_at)}</span>
                  <Badge>{paymentLabels[sale.payment_method] ?? sale.payment_method}</Badge>
                  <span className="font-semibold text-foreground">{formatCurrency(sale.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
