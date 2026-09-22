import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { daysSince, getPeriodRange, resolvePeriod } from "@/lib/report-periods";
import { PeriodSelector } from "@/app/(dashboard)/reportes/period-selector";
import { ReportesDashboard, type ReportesData } from "@/app/(dashboard)/reportes/reportes-dashboard";
import type { SaleRow } from "@/components/dashboard/ventas-list";

const paymentLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  qr: "QR",
  mixto: "Mixto",
  fiado: "Fiado",
};

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" }).format(date);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam);
  const { start, label: periodLabel, groupBy } = getPeriodRange(period);

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: salesRaw } = await supabase
    .from("sales")
    .select("id, total, payment_method, created_at, customer_id")
    .eq("org_id", organization.id)
    .eq("status", "completada")
    .gte("created_at", start.toISOString())
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

  const customerIds = Array.from(
    new Set(sales.map((s) => s.customer_id).filter((id): id is string => Boolean(id)))
  );

  const [{ data: productsRaw }, { data: customersRaw }] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, cost").in("id", productIds)
      : Promise.resolve({ data: [] }),
    customerIds.length > 0
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const costById = new Map((productsRaw ?? []).map((p) => [p.id, Number(p.cost ?? 0)]));
  const customerNameById = new Map((customersRaw ?? []).map((c) => [c.id, c.name]));

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
    paymentTotals.set(
      sale.payment_method,
      (paymentTotals.get(sale.payment_method) ?? 0) + sale.total
    );
  }
  const paymentBreakdown = Array.from(paymentTotals.entries())
    .map(([method, total]) => ({ label: paymentLabels[method] ?? method, value: total }))
    .sort((a, b) => b.value - a.value);

  const byProductQty = new Map<string, { name: string; quantity: number; margin: number }>();
  for (const item of items) {
    const key = item.product_id ?? item.product_name;
    const current = byProductQty.get(key) ?? { name: item.product_name, quantity: 0, margin: 0 };
    current.quantity += item.quantity;
    current.margin +=
      item.subtotal - item.quantity * (item.product_id ? costById.get(item.product_id) ?? 0 : 0);
    byProductQty.set(key, current);
  }
  const topByQuantity = Array.from(byProductQty.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map((p) => ({ name: p.name, quantity: p.quantity }));
  const topByMargin = Array.from(byProductQty.values())
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5)
    .map((p) => ({ name: p.name, margin: p.margin }));

  const byCustomer = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.customer_id) continue;
    byCustomer.set(sale.customer_id, (byCustomer.get(sale.customer_id) ?? 0) + sale.total);
  }
  const topCustomers = Array.from(byCustomer.entries())
    .map(([customerId, total]) => ({
      name: customerNameById.get(customerId) ?? "Cliente eliminado",
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  let revenueChart;
  if (groupBy === "hour") {
    const hourTotals = Array.from({ length: 24 }, () => 0);
    for (const sale of sales) {
      const hour = new Date(sale.created_at).getHours();
      hourTotals[hour] += sale.total;
    }
    revenueChart = hourTotals.map((value, hour) => ({ label: `${hour}h`, value }));
  } else {
    const dayCount = daysSince(start);
    const days = Array.from({ length: dayCount }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return date;
    });
    revenueChart = days.map((date) => {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const value = sales
        .filter((s) => {
          const created = new Date(s.created_at);
          return created >= date && created < next;
        })
        .reduce((acc, s) => acc + s.total, 0);
      return { label: dayLabel(date), value };
    });
  }

  const itemsBySale = new Map<string, string[]>();
  for (const item of items) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    list.push(item.quantity > 1 ? `${item.product_name} x${item.quantity}` : item.product_name);
    itemsBySale.set(item.sale_id, list);
  }

  const saleRows: SaleRow[] = sales.slice(0, 15).map((sale) => ({
    id: sale.id,
    created_at: sale.created_at,
    total: sale.total,
    payment_method: sale.payment_method,
    customerName: sale.customer_id
      ? customerNameById.get(sale.customer_id) ?? "Cliente eliminado"
      : "Consumidor Final",
    itemsSummary: (itemsBySale.get(sale.id) ?? []).join(", ") || "Sin detalle",
  }));

  const data: ReportesData = {
    periodLabel,
    tiles: [
      { icon: "dollar", label: `Ingresos (${periodLabel})`, value: formatCurrency(ingresos) },
      { icon: "trending", label: "Ganancia estimada", value: formatCurrency(gananciaEstimada) },
      { icon: "chart", label: "Total de ventas", value: String(totalVentas) },
      { icon: "receipt", label: "Ticket promedio", value: formatCurrency(ticketPromedio) },
    ],
    revenueChart,
    revenueChartIsHourly: groupBy === "hour",
    paymentBreakdown,
    topByQuantity,
    topByMargin,
    topCustomers,
    saleRows,
  };

  return (
    <div className="space-y-6">
      <PeriodSelector period={period} />
      <ReportesDashboard data={data} />
    </div>
  );
}
