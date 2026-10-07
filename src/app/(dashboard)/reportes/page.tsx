import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCompareRange, getReportRange, resolveReportQuery } from "@/lib/report-periods";
import { ARG_TZ, argDateString, argHour } from "@/lib/timezone";
import { PeriodSelector } from "@/app/(dashboard)/reportes/period-selector";
import { SellerSelector } from "@/app/(dashboard)/reportes/seller-selector";
import { BranchSelector } from "@/app/(dashboard)/reportes/branch-selector";
import { getBranchContext } from "@/lib/branches";
import { reportesHref } from "@/lib/report-periods";
import Link from "next/link";
import {
  ReportesDashboard,
  type CashDiffRow,
  type ReportesData,
  type SellerRow,
} from "@/app/(dashboard)/reportes/reportes-dashboard";
import type { SaleRow } from "@/components/dashboard/ventas-list";
import { getFiadoAmountsBySale } from "@/lib/sale-payments";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import { getMemberLabelsById } from "@/lib/member-labels";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { buildReportInsights } from "@/lib/report-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { Sparkles } from "lucide-react";

const paymentLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  qr: "QR",
  mixto: "Mixto",
  fiado: "Fiado",
};

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(y), Number(m) - 1, 15))
  );
}

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
  searchParams: Promise<{ period?: string; desde?: string; hasta?: string; comparar?: string; vendedor?: string; sucursal?: string }>;
}) {
  const params = await searchParams;
  const vendedorParam = params.vendedor;

  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const isManager = membership.role === "owner" || membership.role === "admin";
  const subscription = await getSubscription(supabase, organization.id);
  // Fechas a medida: desde el Plan Esencial (sin él, vuelve a 30 días).
  const canCustomRange = canUse(subscription, "customReportRange");
  const query = resolveReportQuery(params, { allowCustom: canCustomRange });
  const range = getReportRange(query);
  const { start, end, label: periodLabel, groupBy } = range;
  // Ganancias y comparación de períodos: reporte de ganancias (Plan Pro).
  // Ventas y diferencias de caja por vendedor: reportes por empleado (Plan Pro).
  const canProfit = canUse(subscription, "profitReports");
  const canTeam = canUse(subscription, "teamReports");
  const memberLabelsById =
    isManager && canTeam ? await getMemberLabelsById(supabase, organization.id) : null;

  // Filtro por vendedor: sólo dueños/administradores. Se acepta también un
  // usuario que ya no está en el negocio (llega desde "Ventas por vendedor").
  const sellerId =
    isManager && vendedorParam && /^[0-9a-f-]{36}$/i.test(vendedorParam) ? vendedorParam : null;
  const sellerLabel = sellerId ? memberLabelsById?.get(sellerId) ?? "Usuario eliminado" : null;

  // Filtro por sucursal: sólo dueños/administradores con más de una sucursal.
  const branchContext = await getBranchContext();
  const hasBranches = isManager && branchContext.branches.length > 1;
  const branchId =
    hasBranches && branchContext.branches.some((b) => b.id === params.sucursal)
      ? (params.sucursal as string)
      : null;
  const branchLabel = branchId ? (branchContext.branches.find((b) => b.id === branchId)?.name ?? null) : null;

  const salesRaw = await fetchAll((from, to) => {
    let query = supabase
      .from("sales")
      .select("id, user_id, total, payment_method, invoice_type, created_at, customer_id, branch_id")
      .eq("org_id", organization.id)
      .eq("status", "completada")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (sellerId) query = query.eq("user_id", sellerId);
    if (branchId) query = query.eq("branch_id", branchId);
    return query
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
  });

  const sales = salesRaw.map((s) => ({ ...s, total: Number(s.total) }));
  const saleIds = sales.map((s) => s.id);

  const itemsRaw = await fetchAllIn(saleIds, (ids, from, to) =>
    supabase
      .from("sale_items")
      .select("sale_id, product_id, product_name, quantity, unit_price, subtotal")
      .in("sale_id", ids)
      .order("id")
      .range(from, to)
  );

  const items = itemsRaw.map((i) => ({
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

  const [productsRaw, customersRaw] = await Promise.all([
    fetchAllIn(productIds, (ids, from, to) =>
      supabase.from("products").select("id, cost").in("id", ids).order("id").range(from, to)
    ),
    fetchAllIn(customerIds, (ids, from, to) =>
      supabase.from("customers").select("id, name").in("id", ids).order("id").range(from, to)
    ),
  ]);

  const costById = new Map(productsRaw.map((p) => [p.id, Number(p.cost ?? 0)]));
  const customerNameById = new Map(customersRaw.map((c) => [c.id, c.name]));

  const ingresos = sales.reduce((acc, s) => acc + s.total, 0);
  const totalVentas = sales.length;
  const ticketPromedio = totalVentas > 0 ? ingresos / totalVentas : 0;
  const costoTotal = items.reduce(
    (acc, i) => acc + i.quantity * (i.product_id ? costById.get(i.product_id) ?? 0 : 0),
    0
  );
  const gananciaEstimada = ingresos - costoTotal;

  // Ventas por vendedor (dueños/administradores): cantidad, ingresos y
  // ganancia estimada de cada uno, con el mismo costo que los indicadores.
  const costBySale = new Map<string, number>();
  for (const item of items) {
    if (!item.product_id) continue;
    costBySale.set(
      item.sale_id,
      (costBySale.get(item.sale_id) ?? 0) + item.quantity * (costById.get(item.product_id) ?? 0)
    );
  }
  let sellerRows: SellerRow[] | null = null;
  if (memberLabelsById) {
    const totalsBySeller = new Map<string, { ventas: number; ingresos: number; costo: number }>();
    for (const sale of sales) {
      const current = totalsBySeller.get(sale.user_id) ?? { ventas: 0, ingresos: 0, costo: 0 };
      current.ventas += 1;
      current.ingresos += sale.total;
      current.costo += costBySale.get(sale.id) ?? 0;
      totalsBySeller.set(sale.user_id, current);
    }
    sellerRows = Array.from(totalsBySeller.entries())
      .map(([userId, t]) => ({
        userId,
        userLabel: memberLabelsById.get(userId) ?? "Usuario eliminado",
        ventas: t.ventas,
        ingresos: t.ingresos,
        ganancia: t.ingresos - t.costo,
        ticketPromedio: t.ingresos / t.ventas,
        share: ingresos > 0 ? t.ingresos / ingresos : 0,
      }))
      .sort((a, b) => b.ingresos - a.ingresos);
  }

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
    // Sin product_id es un monto libre (o un producto borrado): no tiene costo
    // y todos los "Monto libre" se sumarían juntos, así que no va en los rankings.
    if (!item.product_id) continue;
    const current = byProductQty.get(item.product_id) ?? {
      name: item.product_name,
      quantity: 0,
      margin: 0,
    };
    current.quantity += item.quantity;
    current.margin += item.subtotal - item.quantity * (costById.get(item.product_id) ?? 0);
    byProductQty.set(item.product_id, current);
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
  const lossProducts = canProfit
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
  } else if (groupBy === "month") {
    // Rangos largos (más de 3 meses): una barra por mes.
    const monthTotals = new Map<string, number>();
    for (const sale of sales) {
      const key = argDateString(new Date(sale.created_at)).slice(0, 7);
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + sale.total);
    }
    const months: string[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      const key = argDateString(cursor).slice(0, 7);
      if (!months.includes(key)) months.push(key);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    revenueChart = months.map((key) => ({ label: monthLabel(key), value: monthTotals.get(key) ?? 0 }));
  } else {
    const days = Array.from({ length: range.days }, (_, i) => {
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
  if (memberLabelsById) {
    const closedRegisters = await fetchAll((from, to) => {
      let query = supabase
        .from("cash_registers")
        .select("user_id, expected_amount, closing_amount")
        .eq("org_id", organization.id)
        .eq("status", "cerrada")
        .gte("closed_at", start.toISOString())
        .lt("closed_at", end.toISOString());
      if (sellerId) query = query.eq("user_id", sellerId);
      if (branchId) query = query.eq("branch_id", branchId);
      return query.order("id").range(from, to);
    });

    const totalsByUser = new Map<
      string,
      { cajasCerradas: number; faltante: number; sobrante: number }
    >();
    for (const r of closedRegisters) {
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
  // Es de todo el negocio: filtrando por vendedor no se muestra ni se consulta.
  const debtors = sellerId || branchId ? [] : await fetchAll((from, to) =>
    supabase
      .from("customers")
      .select("id, name, balance")
      .eq("org_id", organization.id)
      .gt("balance", 0)
      .order("balance", { ascending: false })
      .order("id")
      .range(from, to)
  );

  const lastPaymentByCustomer = new Map<string, string>();
  const paymentsRaw = await fetchAllIn(
    debtors.map((d) => d.id),
    (ids, from, to) =>
      supabase
        .from("customer_payments")
        .select("customer_id, created_at")
        .in("customer_id", ids)
        .order("id")
        .range(from, to)
  );
  for (const p of paymentsRaw) {
    const current = lastPaymentByCustomer.get(p.customer_id);
    if (!current || new Date(p.created_at) > new Date(current)) {
      lastPaymentByCustomer.set(p.customer_id, p.created_at);
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
  const stockProductsRaw = sellerId || branchId ? [] : await fetchAll((from, to) =>
    supabase
      .from("products")
      .select("cost, price, stock")
      .eq("org_id", organization.id)
      .eq("active", true)
      .order("id")
      .range(from, to)
  );

  const stockValue = stockProductsRaw.reduce(
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
  const compareRange = canProfit ? getCompareRange(range, query.compare) : null;
  if (compareRange) {
    const previousStart = compareRange.start;
    const previousEnd = compareRange.end;
    const previousSalesRaw = await fetchAll((from, to) => {
      let query = supabase
        .from("sales")
        .select("id, total")
        .eq("org_id", organization.id)
        .eq("status", "completada")
        .gte("created_at", previousStart.toISOString())
        .lt("created_at", previousEnd.toISOString());
      if (sellerId) query = query.eq("user_id", sellerId);
      if (branchId) query = query.eq("branch_id", branchId);
      return query.order("id").range(from, to);
    });

    const previousSales = previousSalesRaw.map((s) => ({ ...s, total: Number(s.total) }));
    const previousIngresos = previousSales.reduce((acc, s) => acc + s.total, 0);
    const previousVentas = previousSales.length;
    const previousTicket = previousVentas > 0 ? previousIngresos / previousVentas : 0;

    const previousSaleIds = previousSales.map((s) => s.id);
    const previousItemsRaw = await fetchAllIn(previousSaleIds, (ids, from, to) =>
      supabase
        .from("sale_items")
        .select("product_id, quantity")
        .in("sale_id", ids)
        .order("id")
        .range(from, to)
    );

    // El período anterior puede haber vendido productos que no aparecen en
    // el actual — completar el costo de esos para poder estimar su margen.
    const missingProductIds = Array.from(
      new Set(
        previousItemsRaw
          .map((i) => i.product_id)
          .filter((id): id is string => id !== null && !costById.has(id))
      )
    );
    const extraProductsRaw = await fetchAllIn(missingProductIds, (ids, from, to) =>
      supabase.from("products").select("id, cost").in("id", ids).order("id").range(from, to)
    );
    for (const p of extraProductsRaw) {
      costById.set(p.id, Number(p.cost ?? 0));
    }

    const previousCosto = previousItemsRaw.reduce(
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

  const aiSummary = canUse(subscription, "aiReports")
    ? buildReportInsights({
        sales,
        ingresos,
        ganancia: gananciaEstimada,
        deltaPct: periodComparison?.deltaPct ?? null,
        comparisonLabel: compareRange?.label ?? null,
        topByQuantity,
        topByMargin,
        lossProducts: lossProducts ?? [],
        paymentBreakdown,
        fiadoOwed: fiadoDebtors.reduce((n, d) => n + d.amount, 0),
        singleDay: groupBy === "hour",
      })
    : null;

  const data: ReportesData = {
    periodLabel,
    branchId,
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
        value: canProfit ? formatCurrency(gananciaEstimada) : "Plan Pro",
        locked: !canProfit,
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
    topByMargin: canProfit ? topByMargin : null,
    topCustomers,
    saleRows,
    cashDiffByUser,
    sellerRows,
    sellerLabel,
    fiadoDebtors,
    stockValue,
    hasProAccess: canProfit,
    teamLocked: isManager && !canTeam,
    periodComparison,
    comparisonLabel: compareRange?.label ?? null,
    lossProducts,
  };

  // Ventas por sucursal del período (sólo sin filtro de sucursal).
  const salesByBranch = (() => {
    if (!hasBranches || branchId) return [] as { id: string; name: string; count: number; total: number; ganancia: number; pct: number }[];
    const grand = sales.reduce((acc, sale) => acc + sale.total, 0);
    return branchContext.branches
      .map((b) => {
        const mine = sales.filter((sale) => sale.branch_id === b.id);
        const total = mine.reduce((acc, sale) => acc + sale.total, 0);
        const costo = mine.reduce((acc, sale) => acc + (costBySale.get(sale.id) ?? 0), 0);
        return {
          id: b.id,
          name: b.name,
          count: mine.length,
          total,
          ganancia: total - costo,
          pct: grand > 0 ? Math.round((total / grand) * 100) : 0,
        };
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.total - a.total);
  })();

  const branchTable =
    hasBranches && !branchId && salesByBranch.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventas por sucursal</CardTitle>
          <p className="text-xs text-muted-foreground">Tocá una sucursal para ver solo sus reportes. La ganancia es estimada, con el costo actual de cada producto.</p>
        </CardHeader>
        <div className="overflow-x-auto pb-2 pt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-2">Sucursal</th>
                <th className="px-3 py-2 text-right">Ventas</th>
                <th className="px-3 py-2 text-right">Vendido</th>
                <th className="px-3 py-2 text-right">Ganancia</th>
                <th className="px-5 py-2 text-right">Parte del total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {salesByBranch.map((row) => (
                <tr key={row.id} className="hover:bg-muted">
                  <td className="px-5 py-2.5 font-medium text-foreground">
                    <Link href={reportesHref(query, sellerId, row.id)} prefetch={false} className="block">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right text-foreground">{row.count}</td>
                  <td className="px-3 py-2.5 text-right text-foreground">{formatCurrency(row.total)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {canProfit ? (
                      <span className="font-medium text-success">{formatCurrency(row.ganancia)}</span>
                    ) : (
                      <Link href="/planes" prefetch={false} className="text-xs font-semibold text-primary hover:underline">
                        Plan Pro
                      </Link>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground">{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelector
          query={query}
          sellerId={sellerId}
          rangeLabel={periodLabel.replace(/^del |^el /, "")}
          today={argDateString()}
          canCustomRange={canCustomRange}
          canCompare={canProfit}
          branchId={branchId}
        />
        {memberLabelsById && (
          <SellerSelector
            query={query}
            sellerId={sellerId}
            sellers={Array.from(memberLabelsById.entries())
              .map(([id, label]) => ({ id, label }))
              .sort((a, b) => a.label.localeCompare(b.label, "es"))}
            sellerLabel={sellerLabel}
            branchId={branchId}
          />
        )}
        {hasBranches && (
          <BranchSelector
            query={query}
            sellerId={sellerId}
            branchId={branchId}
            branches={branchContext.branches.map((b) => ({ id: b.id, name: b.name }))}
          />
        )}
      </div>
      {sellerLabel && (
        <p className="text-sm text-muted-foreground">
          Mostrando sólo las ventas y cajas de{" "}
          <span className="font-medium text-foreground">{sellerLabel}</span>. Fiado y stock son
          de todo el negocio y no se muestran.
        </p>
      )}
      {branchLabel && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>
            Mostrando sólo las ventas y cajas de la sucursal{" "}
            <span className="font-medium text-foreground">{branchLabel}</span>. Fiado y stock son de
            todo el negocio y no se muestran.
          </span>
          <Link
            href={reportesHref(query, sellerId, null)}
            prefetch={false}
            className="font-semibold text-primary hover:underline"
          >
            Quitar filtro
          </Link>
        </p>
      )}
      {aiSummary ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-base">Resumen del período</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
              {aiSummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <PlanLockNote plan={featureMinPlan.aiReports}>
          El Plan IA te escribe un resumen de cada período: cómo vendiste, tu mejor día y horario, qué te deja más plata y qué vendés a pérdida.
        </PlanLockNote>
      )}
      <ReportesDashboard data={data} query={query} afterTiles={branchTable} />
    </div>
  );
}
