import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCompareRange, getReportRange, resolveReportQuery } from "@/lib/report-periods";
import { ARG_TZ, argDateString } from "@/lib/timezone";
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
import { RATE_LIMITED_MESSAGE, isRateLimitError } from "@/lib/rate-limit";
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

interface Overview {
  ventas: number;
  ingresos: number;
  costo: number;
  chart: { k: string; v: number }[];
  payments: { method: string; total: number }[];
  sellers: { user_id: string; ventas: number; ingresos: number; costo: number }[];
  branches: { branch_id: string | null; ventas: number; ingresos: number; costo: number }[];
  top_quantity: { name: string; quantity: number }[];
  top_margin: { name: string; margin: number }[];
  loss: { name: string; quantity: number; loss: number }[];
  customers: { customer_id: string | null; name: string | null; total: number }[];
  weekdays: { dow: number; total: number; days: number }[];
  hours: { hour: number; total: number }[];
  recent: {
    id: string;
    created_at: string;
    total: number;
    payment_method: string;
    invoice_type: string | null;
    customer_id: string | null;
    customer_name: string | null;
    items: string[];
  }[];
}

// Todo lo que muestra Reportes, ya sumado por la base (report_overview, 0061):
// una consulta de pocos KB en vez de traer todas las ventas y sus ítems.
async function rpcOverview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    p_org_id: string;
    p_start: string;
    p_end: string;
    p_seller: string | null;
    p_branch: string | null;
    p_group: string;
  }
): Promise<Overview | "rate_limited"> {
  const { data, error } = await supabase.rpc("report_overview", args);
  if (isRateLimitError(error)) return "rate_limited";
  if (error) throw new Error(`No se pudieron cargar los reportes: ${error.message}`);
  // numeric llega como número o texto según el valor: normalizar.
  const raw = (data ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0);
  const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ventas: n(raw.ventas),
    ingresos: n(raw.ingresos),
    costo: n(raw.costo),
    chart: list<{ k: string; v: unknown }>(raw.chart).map((c) => ({ k: c.k, v: n(c.v) })),
    payments: list<{ method: string; total: unknown }>(raw.payments).map((p) => ({ method: p.method, total: n(p.total) })),
    sellers: list<{ user_id: string; ventas: unknown; ingresos: unknown; costo: unknown }>(raw.sellers).map((x) => ({
      user_id: x.user_id,
      ventas: n(x.ventas),
      ingresos: n(x.ingresos),
      costo: n(x.costo),
    })),
    branches: list<{ branch_id: string | null; ventas: unknown; ingresos: unknown; costo: unknown }>(raw.branches).map((x) => ({
      branch_id: x.branch_id,
      ventas: n(x.ventas),
      ingresos: n(x.ingresos),
      costo: n(x.costo),
    })),
    top_quantity: list<{ name: string; quantity: unknown }>(raw.top_quantity).map((x) => ({ name: x.name, quantity: n(x.quantity) })),
    top_margin: list<{ name: string; margin: unknown }>(raw.top_margin).map((x) => ({ name: x.name, margin: n(x.margin) })),
    loss: list<{ name: string; quantity: unknown; loss: unknown }>(raw.loss).map((x) => ({
      name: x.name,
      quantity: n(x.quantity),
      loss: n(x.loss),
    })),
    customers: list<{ customer_id: string | null; name: string | null; total: unknown }>(raw.customers).map((x) => ({
      customer_id: x.customer_id,
      name: x.name,
      total: n(x.total),
    })),
    weekdays: list<{ dow: number; total: unknown; days: unknown }>(raw.weekdays).map((x) => ({
      dow: x.dow,
      total: n(x.total),
      days: n(x.days),
    })),
    hours: list<{ hour: number; total: unknown }>(raw.hours).map((x) => ({ hour: x.hour, total: n(x.total) })),
    recent: list<{
      id: string;
      created_at: string;
      total: unknown;
      payment_method: string;
      invoice_type: string | null;
      customer_id: string | null;
      customer_name: string | null;
      items: string[];
    }>(raw.recent).map((x) => ({ ...x, total: n(x.total) })),
  };
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

  const ov = await rpcOverview(supabase, {
    p_org_id: organization.id,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_seller: sellerId,
    p_branch: branchId,
    p_group: groupBy,
  });

  if (ov === "rate_limited") {
    return (
      <Card>
        <CardContent className="space-y-3 p-5 text-center">
          <p className="text-sm font-medium text-foreground">{RATE_LIMITED_MESSAGE}</p>
          <Link
            href={reportesHref(query, sellerId, branchId)}
            prefetch={false}
            className="inline-block text-sm font-semibold text-primary hover:underline"
          >
            Reintentar
          </Link>
        </CardContent>
      </Card>
    );
  }

  const ingresos = ov.ingresos;
  const totalVentas = ov.ventas;
  const ticketPromedio = totalVentas > 0 ? ingresos / totalVentas : 0;
  const costoTotal = ov.costo;
  const gananciaEstimada = ingresos - costoTotal;

  // Ventas por vendedor (dueños/administradores): cantidad, ingresos y
  // ganancia estimada de cada uno, con el mismo costo que los indicadores.
  let sellerRows: SellerRow[] | null = null;
  if (memberLabelsById) {
    sellerRows = ov.sellers
      .map((t) => ({
        userId: t.user_id,
        userLabel: memberLabelsById.get(t.user_id) ?? "Usuario eliminado",
        ventas: t.ventas,
        ingresos: t.ingresos,
        ganancia: t.ingresos - t.costo,
        ticketPromedio: t.ingresos / t.ventas,
        share: ingresos > 0 ? t.ingresos / ingresos : 0,
      }))
      .sort((a, b) => b.ingresos - a.ingresos);
  }

  const paymentBreakdown = ov.payments
    .map((p) => ({ label: paymentLabels[p.method] ?? p.method, value: p.total }))
    .sort((a, b) => b.value - a.value);

  // Sin product_id es un monto libre (o un producto borrado): no tiene costo
  // y todos los "Monto libre" se sumarían juntos, así que no va en los rankings.
  // Un producto vendido a pérdida no es "el que más ganancia deja": el ranking
  // de margen sólo trae los de margen positivo.
  const topByQuantity = ov.top_quantity;
  const topByMargin = ov.top_margin;

  // Reporte Pro: productos vendidos a pérdida (margen negativo), los que
  // "más ganancia dejan" arriba justamente excluye.
  const lossProducts = canProfit ? ov.loss : null;

  const topCustomers = ov.customers.map((c) => ({
    name: c.customer_id === null ? "Consumidor Final" : (c.name ?? "Cliente eliminado"),
    total: c.total,
  }));

  let revenueChart;
  const chartByKey = new Map(ov.chart.map((c) => [c.k, c.v]));
  if (groupBy === "hour") {
    revenueChart = Array.from({ length: 24 }, (_, hour) => ({
      label: `${hour}h`,
      value: chartByKey.get(String(hour).padStart(2, "0")) ?? 0,
    }));
  } else if (groupBy === "month") {
    // Rangos largos (más de 3 meses): una barra por mes.
    const months: string[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      const key = argDateString(cursor).slice(0, 7);
      if (!months.includes(key)) months.push(key);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    revenueChart = months.map((key) => ({ label: monthLabel(key), value: chartByKey.get(key) ?? 0 }));
  } else {
    revenueChart = Array.from({ length: range.days }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      return { label: dayLabel(date), value: chartByKey.get(argDateString(date)) ?? 0 };
    });
  }

  const fiadoBySale = await getFiadoAmountsBySale(
    supabase,
    ov.recent.map((s) => s.id)
  );

  const saleRows: SaleRow[] = ov.recent.map((sale) => ({
    id: sale.id,
    created_at: sale.created_at,
    total: sale.total,
    payment_method: sale.payment_method,
    invoice_type: sale.invoice_type ?? "consumidor_final",
    customerName: sale.customer_id
      ? sale.customer_name ?? "Cliente eliminado"
      : "Consumidor Final",
    itemsSummary: sale.items.join(", ") || "Sin detalle",
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
  const stockValue =
    sellerId || branchId
      ? { atCost: 0, atPrice: 0 }
      : await supabase
          .rpc("report_stock_value", { p_org_id: organization.id })
          .then(({ data }) => {
            const v = (data ?? {}) as { at_cost?: number | string; at_price?: number | string };
            return { atCost: Number(v.at_cost ?? 0), atPrice: Number(v.at_price ?? 0) };
          });

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
    const { data: previousRaw } = await supabase.rpc("report_totals", {
      p_org_id: organization.id,
      p_start: previousStart.toISOString(),
      p_end: previousEnd.toISOString(),
      p_seller: sellerId,
      p_branch: branchId,
    });
    const previous = (previousRaw ?? {}) as { ventas?: number | string; ingresos?: number | string; costo?: number | string };
    const previousIngresos = Number(previous.ingresos ?? 0);
    const previousVentas = Number(previous.ventas ?? 0);
    const previousTicket = previousVentas > 0 ? previousIngresos / previousVentas : 0;
    const previousGanancia = previousIngresos - Number(previous.costo ?? 0);

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
        salesCount: totalVentas,
        weekdays: ov.weekdays,
        hours: Array.from({ length: 24 }, (_, h) => ov.hours.find((x) => x.hour === h)?.total ?? 0),
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
    stockBreakdownLocked: !canUse(subscription, "stockManagement"),
    hasProAccess: canProfit,
    teamLocked: isManager && !canTeam,
    periodComparison,
    comparisonLabel: compareRange?.label ?? null,
    lossProducts,
  };

  // Ventas por sucursal del período (sólo sin filtro de sucursal).
  const salesByBranch = (() => {
    if (!hasBranches || branchId) return [] as { id: string; name: string; count: number; total: number; ganancia: number; pct: number }[];
    return branchContext.branches
      .map((b) => {
        const mine = ov.branches.find((x) => x.branch_id === b.id);
        const total = mine?.ingresos ?? 0;
        return {
          id: b.id,
          name: b.name,
          count: mine?.ventas ?? 0,
          total,
          ganancia: total - (mine?.costo ?? 0),
          pct: ingresos > 0 ? Math.round((total / ingresos) * 100) : 0,
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

  const summaryBlock = (
    aiSummary ? (
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
    )
  );

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
      <ReportesDashboard
        data={data}
        query={query}
        afterTiles={
          <>
            {branchTable}
            {summaryBlock}
          </>
        }
      />
    </div>
  );
}
