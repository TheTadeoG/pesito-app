import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { daysSince, getPeriodRange, resolvePeriod } from "@/lib/report-periods";
import { ARG_TZ, argHour } from "@/lib/timezone";
import { PeriodSelector } from "@/app/(dashboard)/reportes/period-selector";
import {
  ReportesDashboard,
  type CashDiffRow,
  type ReportesData,
} from "@/app/(dashboard)/reportes/reportes-dashboard";
import type { SaleRow } from "@/components/dashboard/ventas-list";
import { getFiadoAmountsBySale } from "@/lib/sale-payments";
import { getMemberLabelsById } from "@/lib/member-labels";
import { getSubscription } from "@/lib/subscription";

const paymentLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  qr: "QR",
  mixto: "Mixto",
  fiado: "Fiado",
};

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    timeZone: ARG_TZ,
  }).format(date);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam);
  const { start, label: periodLabel, groupBy } = getPeriodRange(period);

  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const isManager = membership.role === "owner" || membership.role === "admin";
  const subscription = await getSubscription(supabase, organization.id);

  const { data: salesRaw } = await supabase
    .from("sales")
    .select("id, total, payment_method, invoice_type, created_at, customer_id")
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
    // Un producto vendido a pérdida no es "el que más ganancia deja" — no
    // tiene sentido mostrarlo acá con margen negativo.
    .filter((p) => p.margin >= 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5)
    .map((p) => ({ name: p.name, margin: p.margin }));

  // Reporte Pro: productos vendidos a pérdida (margen negativo), los que
  // "más ganancia dejan" arriba justamente excluye.
  const lossProducts = subscription.hasProAccess
    ? Array.from(byProductQty.values())
        .filter((p) => p.margin < 0)
        .sort((a, b) => a.margin - b.margin)
        .slice(0, 5)
        .map((p) => ({ name: p.name, quantity: p.quantity, loss: -p.margin }))
    : null;

  let consumidorFinalTotal = 0;
  const byCustomer = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.customer_id) {
      consumidorFinalTotal += sale.total;
      continue;
    }
    byCustomer.set(sale.customer_id, (byCustomer.get(sale.customer_id) ?? 0) + sale.total);
  }
  const topCustomers = [
    ...(consumidorFinalTotal > 0
      ? [{ name: "Consumidor Final", total: consumidorFinalTotal }]
      : []),
    ...Array.from(byCustomer.entries()).map(([customerId, total]) => ({
      name: customerNameById.get(customerId) ?? "Cliente eliminado",
      total,
    })),
  ]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  let revenueChart;
  if (groupBy === "hour") {
    const hourTotals = Array.from({ length: 24 }, () => 0);
    for (const sale of sales) {
      const hour = argHour(new Date(sale.created_at));
      hourTotals[hour] += sale.total;
    }
    revenueChart = hourTotals.map((value, hour) => ({ label: `${hour}h`, value }));
  } else {
    const dayCount = daysSince(start);
    const days = Array.from({ length: dayCount }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      return date;
    });
    revenueChart = days.map((date) => {
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + 1);
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

  const recentSales = sales.slice(0, 15);
  const fiadoBySale = await getFiadoAmountsBySale(
    supabase,
    recentSales.map((s) => s.id)
  );

  const saleRows: SaleRow[] = recentSales.map((sale) => ({
    id: sale.id,
    created_at: sale.created_at,
    total: sale.total,
    payment_method: sale.payment_method,
    invoice_type: sale.invoice_type,
    customerName: sale.customer_id
      ? customerNameById.get(sale.customer_id) ?? "Cliente eliminado"
      : "Consumidor Final",
    itemsSummary: (itemsBySale.get(sale.id) ?? []).join(", ") || "Sin detalle",
    fiadoAmount: fiadoBySale.get(sale.id) ?? 0,
  }));

  let cashDiffByUser: CashDiffRow[] | null = null;
  if (isManager) {
    const { data: closedRegisters } = await supabase
      .from("cash_registers")
      .select("user_id, expected_amount, closing_amount")
      .eq("org_id", organization.id)
      .eq("status", "cerrada")
      .gte("closed_at", start.toISOString());

    const memberLabelsById = await getMemberLabelsById(supabase, organization.id);
    const totalsByUser = new Map<
      string,
      { cajasCerradas: number; faltante: number; sobrante: number }
    >();
    for (const r of closedRegisters ?? []) {
      const diff = Number(r.closing_amount ?? 0) - Number(r.expected_amount ?? 0);
      const current = totalsByUser.get(r.user_id) ?? {
        cajasCerradas: 0,
        faltante: 0,
        sobrante: 0,
      };
      current.cajasCerradas += 1;
      if (diff < 0) current.faltante += -diff;
      if (diff > 0) current.sobrante += diff;
      totalsByUser.set(r.user_id, current);
    }

    cashDiffByUser = Array.from(totalsByUser.entries())
      .map(([userId, totals]) => ({
        userLabel: memberLabelsById.get(userId) ?? "Usuario eliminado",
        ...totals,
      }))
      .sort((a, b) => b.faltante + b.sobrante - (a.faltante + a.sobrante));
  }

  // "Quién te debe": clientes con saldo de fiado, con hace cuánto no pagan.
  const { data: debtorsRaw } = await supabase
    .from("customers")
    .select("id, name, balance")
    .eq("org_id", organization.id)
    .gt("balance", 0)
    .order("balance", { ascending: false });

  const debtors = debtorsRaw ?? [];
  const lastPaymentByCustomer = new Map<string, string>();
  if (debtors.length > 0) {
    const { data: paymentsRaw } = await supabase
      .from("customer_payments")
      .select("customer_id, created_at")
      .in(
        "customer_id",
        debtors.map((d) => d.id)
      )
      .order("created_at", { ascending: false });
    // Ordenado desc: la primera vez que vemos un customer_id es su pago
    // más reciente.
    for (const p of paymentsRaw ?? []) {
      if (!lastPaymentByCustomer.has(p.customer_id)) {
        lastPaymentByCustomer.set(p.customer_id, p.created_at);
      }
    }
  }
  const fiadoDebtors = debtors.map((d) => {
    const lastPayment = lastPaymentByCustomer.get(d.id) ?? null;
    return {
      name: d.name,
      amount: Number(d.balance),
      daysSincePayment: lastPayment
        ? // eslint-disable-next-line react-hooks/purity
          Math.floor((Date.now() - new Date(lastPayment).getTime()) / (24 * 60 * 60 * 1000))
        : null,
    };
  });

  // Stock valorizado: cuánta plata hay parada en mercadería, al costo y al
  // precio de venta.
  const { data: stockProductsRaw } = await supabase
    .from("products")
    .select("cost, price, stock")
    .eq("org_id", organization.id)
    .eq("active", true);

  const stockValue = (stockProductsRaw ?? []).reduce(
    (acc, p) => {
      const stock = Number(p.stock);
      acc.atCost += stock * Number(p.cost ?? 0);
      acc.atPrice += stock * Number(p.price);
      return acc;
    },
    { atCost: 0, atPrice: 0 }
  );

  // Reporte Pro: comparación contra el período anterior de la misma
  // duración (p. ej. últimos 7 días vs los 7 días previos). De acá también
  // salen las flechitas de tendencia de los indicadores principales.
  let periodComparison: { ingresos: number; deltaPct: number | null } | null = null;
  let tileDeltas: {
    ingresosPct: number | null;
    gananciaPct: number | null;
    ventasPct: number | null;
    ticketPct: number | null;
  } | null = null;
  if (subscription.hasProAccess) {
    // eslint-disable-next-line react-hooks/purity
    const durationMs = Date.now() - start.getTime();
    const previousStart = new Date(start.getTime() - durationMs);
    const { data: previousSalesRaw } = await supabase
      .from("sales")
      .select("id, total")
      .eq("org_id", organization.id)
      .eq("status", "completada")
      .gte("created_at", previousStart.toISOString())
      .lt("created_at", start.toISOString());

    const previousSales = (previousSalesRaw ?? []).map((s) => ({ ...s, total: Number(s.total) }));
    const previousIngresos = previousSales.reduce((acc, s) => acc + s.total, 0);
    const previousVentas = previousSales.length;
    const previousTicket = previousVentas > 0 ? previousIngresos / previousVentas : 0;

    const previousSaleIds = previousSales.map((s) => s.id);
    const { data: previousItemsRaw } =
      previousSaleIds.length > 0
        ? await supabase
            .from("sale_items")
            .select("product_id, quantity")
            .in("sale_id", previousSaleIds)
        : { data: [] };

    // El período anterior puede haber vendido productos que no aparecen en
    // el actual — completar el costo de esos para poder estimar su margen.
    const missingProductIds = Array.from(
      new Set(
        (previousItemsRaw ?? [])
          .map((i) => i.product_id)
          .filter((id): id is string => id !== null && !costById.has(id))
      )
    );
    if (missingProductIds.length > 0) {
      const { data: extraProductsRaw } = await supabase
        .from("products")
        .select("id, cost")
        .in("id", missingProductIds);
      for (const p of extraProductsRaw ?? []) {
        costById.set(p.id, Number(p.cost ?? 0));
      }
    }

    const previousCosto = (previousItemsRaw ?? []).reduce(
      (acc, i) => acc + Number(i.quantity) * (i.product_id ? costById.get(i.product_id) ?? 0 : 0),
      0
    );
    const previousGanancia = previousIngresos - previousCosto;

    const pct = (current: number, previous: number) =>
      previous > 0 ? ((current - previous) / previous) * 100 : null;

    periodComparison = {
      ingresos: previousIngresos,
      deltaPct: pct(ingresos, previousIngresos),
    };
    tileDeltas = {
      ingresosPct: pct(ingresos, previousIngresos),
      gananciaPct: pct(gananciaEstimada, previousGanancia),
      ventasPct: pct(totalVentas, previousVentas),
      ticketPct: pct(ticketPromedio, previousTicket),
    };
  }

  const data: ReportesData = {
    periodLabel,
    tiles: [
      {
        icon: "dollar",
        label: `Ingresos (${periodLabel})`,
        value: formatCurrency(ingresos),
        deltaPct: tileDeltas?.ingresosPct ?? null,
      },
      {
        icon: "trending",
        label: "Ganancia estimada",
        value: formatCurrency(gananciaEstimada),
        deltaPct: tileDeltas?.gananciaPct ?? null,
      },
      {
        icon: "chart",
        label: "Total de ventas",
        value: String(totalVentas),
        deltaPct: tileDeltas?.ventasPct ?? null,
      },
      {
        icon: "receipt",
        label: "Ticket promedio",
        value: formatCurrency(ticketPromedio),
        deltaPct: tileDeltas?.ticketPct ?? null,
      },
    ],
    revenueChart,
    revenueChartIsHourly: groupBy === "hour",
    paymentBreakdown,
    topByQuantity,
    topByMargin,
    topCustomers,
    saleRows,
    cashDiffByUser,
    fiadoDebtors,
    stockValue,
    hasProAccess: subscription.hasProAccess,
    periodComparison,
    lossProducts,
  };

  return (
    <div className="space-y-6">
      <PeriodSelector period={period} />
      <ReportesDashboard data={data} />
    </div>
  );
}
