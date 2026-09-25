import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { daysSince, getPeriodRange, resolvePeriod } from "@/lib/report-periods";
import { ARG_TZ, argHour } from "@/lib/timezone";
import { PeriodSelector } from "@/app/(dashboard)/reportes/period-selector";
import { SellerSelector } from "@/app/(dashboard)/reportes/seller-selector";
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
import { canUse } from "@/lib/plan-access";

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
  searchParams: Promise<{ period?: string; vendedor?: string }>;
}) {
  const { period: periodParam, vendedor: vendedorParam } = await searchParams;
  const period = resolvePeriod(periodParam);
  const { start, label: periodLabel, groupBy } = getPeriodRange(period);

  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const isManager = membership.role === "owner" || membership.role === "admin";
  const subscription = await getSubscription(supabase, organization.id);
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

  const salesRaw = await fetchAll((from, to) => {
    let query = supabase
      .from("sales")
      .select("id, user_id, total, payment_method, invoice_type, created_at, customer_id")
      .eq("org_id", organization.id)
      .eq("status", "completada")
      .gte("created_at", start.toISOString());
    if (sellerId) query = query.eq("user_id", sellerId);
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
  let sellerRows: SellerRow[] | null = null;
  if (memberLabelsById) {
    const costBySale = new Map<string, number>();
    for (const item of items) {
      if (!item.product_id) continue;
      costBySale.set(
        item.sale_id,
        (costBySale.get(item.sale_id) ?? 0) + item.quantity * (costById.get(item.product_id) ?? 0)
      );
    }
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
  if (memberLabelsById) {
    const closedRegisters = await fetchAll((from, to) => {
      let query = supabase
        .from("cash_registers")
        .select("user_id, expected_amount, closing_amount")
        .eq("org_id", organization.id)
        .eq("status", "cerrada")
        .gte("closed_at", start.toISOString());
      if (sellerId) query = query.eq("user_id", sellerId);
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
  const debtors = sellerId ? [] : await fetchAll((from, to) =>
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
  const stockProductsRaw = sellerId ? [] : await fetchAll((from, to) =>
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
  if (canProfit) {
    // eslint-disable-next-line react-hooks/purity
    const durationMs = Date.now() - start.getTime();
    const previousStart = new Date(start.getTime() - durationMs);
    const previousSalesRaw = await fetchAll((from, to) => {
      let query = supabase
        .from("sales")
        .select("id, total")
        .eq("org_id", organization.id)
        .eq("status", "completada")
        .gte("created_at", previousStart.toISOString())
        .lt("created_at", start.toISOString());
      if (sellerId) query = query.eq("user_id", sellerId);
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
    lossProducts,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelector period={period} sellerId={sellerId} />
        {memberLabelsById && (
          <SellerSelector
            period={period}
            sellerId={sellerId}
            sellers={Array.from(memberLabelsById.entries())
              .map(([id, label]) => ({ id, label }))
              .sort((a, b) => a.label.localeCompare(b.label, "es"))}
            sellerLabel={sellerLabel}
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
      <ReportesDashboard data={data} period={period} />
    </div>
  );
}
