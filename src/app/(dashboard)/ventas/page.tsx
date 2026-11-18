import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { isOrgAdmin } from "@/lib/roles";
import { getBranchContext } from "@/lib/branches";
import { ReportesTabs } from "@/components/dashboard/reportes-tabs";
import { getSubscription } from "@/lib/subscription";
import { canUse } from "@/lib/plan-access";
import { getReportRange, periodParams, resolveReportQuery } from "@/lib/report-periods";
import { argDateString } from "@/lib/timezone";
import { PeriodSelector } from "@/app/(dashboard)/reportes/period-selector";
import { getInvoicingConfig } from "@/lib/actions/invoicing";
import { parseSalesSearch } from "@/lib/sales-search";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import { getMemberLabelsById } from "@/lib/member-labels";
import { VentasHistorial, type HistorialRow, type VentasSummary } from "./ventas-historial";

const paymentLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  qr: "QR",
  mixto: "Mixto",
  fiado: "Fiado",
};
const PAGE_SIZES = [25, 50, 100, 200];

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; desde?: string; hasta?: string; medio?: string; estado?: string; comprobante?: string; vendedor?: string; min?: string; max?: string; q?: string; pagina?: string; tam?: string; sucursal?: string }>;
}) {
  const sp = await searchParams;
  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const admin = isOrgAdmin(membership.role);

  // El mismo selector de período que Reportes (hoy, 7 días, 30 días, este mes, fechas a medida…).
  const subscription = await getSubscription(supabase, organization.id);
  const canCustomRange = canUse(subscription, "customReportRange");
  const periodQuery = resolveReportQuery(sp, { allowCustom: canCustomRange });
  const range = getReportRange(periodQuery);
  const desde = argDateString(range.start);
  const hasta = argDateString(new Date(range.end.getTime() - 1));
  const medio = sp.medio && paymentLabels[sp.medio] ? sp.medio : "";
  const estado = sp.estado === "completada" || sp.estado === "anulada" ? sp.estado : "";
  // Tipo de comprobante: facturas, notas de crédito o comprobante X (ventas sin factura electrónica).
  const comprobante = sp.comprobante === "factura" || sp.comprobante === "nc" || sp.comprobante === "x" ? sp.comprobante : "";
  const q = (sp.q ?? "").trim().slice(0, 60);
  // Rango de importe (opcional): sólo números positivos.
  const parseAmount = (v: string | undefined) => {
    const n = Number((v ?? "").replace(",", "."));
    return v && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const minAmount = parseAmount(sp.min);
  const maxAmount = parseAmount(sp.max);
  const pageSize = PAGE_SIZES.includes(Number(sp.tam)) ? Number(sp.tam) : 25;
  const page = Math.max(0, Math.floor(Number(sp.pagina) || 0));
  const branchContext = await getBranchContext();
  const hasBranches = admin && branchContext.branches.length > 1;
  // Vendedor: sólo dueños/administradores (ven las ventas de todo el equipo).
  const memberLabels = admin ? await getMemberLabelsById(supabase, organization.id) : null;
  const vendedor = admin && sp.vendedor && memberLabels?.has(sp.vendedor) ? sp.vendedor : "";
  const sucursal = hasBranches && branchContext.branches.some((b) => b.id === sp.sucursal) ? (sp.sucursal as string) : "";

  // Buscador: cliente (nombre, CUIT o DNI), número de comprobante, CAE o importe. Se arma una lista de
  // condiciones (ventas de esos clientes, ventas de esos comprobantes, ventas de ese importe); con algo
  // escrito que no coincide con nada, no hay resultados.
  const orParts: string[] = [];
  if (q) {
    const parsed = parseSalesSearch(q);
    const [customersFound, vouchersFound] = await Promise.all([
      parsed.text
        ? supabase
            .from("customers")
            .select("id")
            .eq("org_id", organization.id)
            .or(`name.ilike.%${parsed.text}%,razon_social.ilike.%${parsed.text}%,document.ilike.%${parsed.text}%`)
            .limit(150)
        : Promise.resolve({ data: [] as { id: string }[] }),
      parsed.voucherNumber !== null || parsed.cae
        ? supabase
            .from("arca_vouchers")
            .select("sale_id")
            .eq("org_id", organization.id)
            .not("sale_id", "is", null)
            .or([parsed.voucherNumber !== null ? `number.eq.${parsed.voucherNumber}` : null, parsed.cae ? `cae.eq.${parsed.cae}` : null].filter(Boolean).join(","))
            .limit(150)
        : Promise.resolve({ data: [] as { sale_id: string | null }[] }),
    ]);
    const customerIds = (customersFound.data ?? []).map((c) => c.id);
    const saleIds = (vouchersFound.data ?? []).map((v) => v.sale_id).filter((id): id is string => Boolean(id));
    if (customerIds.length > 0) orParts.push(`customer_id.in.(${customerIds.join(",")})`);
    if (saleIds.length > 0) orParts.push(`id.in.(${saleIds.join(",")})`);
    // El número a secas también busca el comprobante interno X.
    if (parsed.voucherNumber !== null) orParts.push(`internal_number.eq.${parsed.voucherNumber}`);
    if (parsed.amount !== null) orParts.push(`total.eq.${parsed.amount}`);
  }
  const nothingMatches = q !== "" && orParts.length === 0;

  let rows: HistorialRow[] = [];
  let total = 0;
  let error: string | null = null;
  let summary: VentasSummary | null = null;
  if (!nothingMatches) {
    const cols = "id, created_at, total, payment_method, invoice_type, status, customer_id, internal_number, user_id";
    // Los mismos filtros para la lista y para los totales de todo el filtro.
    const filtered = (select: string, count: boolean) => {
      // Por tipo de comprobante: se cruza con los comprobantes autorizados de cada venta.
      const selectCols = (comprobante === "factura" || comprobante === "nc" ? `${select}, arca_vouchers!inner(id)` : comprobante === "x" ? `${select}, arca_vouchers(id)` : select) as typeof cols;
      let q2 = supabase
        .from("sales")
        .select(selectCols, count ? { count: "exact" } : undefined)
        .eq("org_id", organization.id)
        .gte("created_at", `${desde}T00:00:00-03:00`)
        .lte("created_at", `${hasta}T23:59:59.999-03:00`);
      if (medio) q2 = q2.eq("payment_method", medio as "efectivo");
      if (estado) q2 = q2.eq("status", estado);
      if (sucursal) q2 = q2.eq("branch_id", sucursal);
      if (vendedor) q2 = q2.eq("user_id", vendedor);
      if (minAmount !== null) q2 = q2.gte("total", minAmount);
      if (maxAmount !== null) q2 = q2.lte("total", maxAmount);
      if (orParts.length > 0) q2 = q2.or(orParts.join(","));
      if (comprobante !== "") q2 = q2.eq("arca_vouchers.kind", comprobante === "nc" ? "credit_note" : "invoice").eq("arca_vouchers.status", "authorized");
      if (comprobante === "x") q2 = q2.is("arca_vouchers", null);
      return q2;
    };
    const query = filtered(cols, true)
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * pageSize, page * pageSize + pageSize - 1);
    const { data, count, error: e } = await query;
    if (e) error = "No pudimos cargar las ventas. Probá de nuevo.";
    total = count ?? 0;

    const sales = data ?? [];
    const customerKeys = Array.from(new Set(sales.map((s) => s.customer_id).filter((x): x is string => Boolean(x))));
    const [customers, vouchers] = await Promise.all([
      customerKeys.length > 0 ? supabase.from("customers").select("id, name").in("id", customerKeys) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      sales.length > 0
        ? supabase.from("arca_vouchers").select("sale_id, kind, status, voucher_class, sales_point, number").in("sale_id", sales.map((s) => s.id)).eq("status", "authorized")
        : Promise.resolve({ data: [] as { sale_id: string | null; kind: string; status: string; voucher_class: string | null; sales_point: number | null; number: number | null }[] }),
    ]);
    const names = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
    const voucherBySale = new Map<string, string>();
    const creditNoteBySale = new Map<string, string>();
    for (const v of vouchers.data ?? []) {
      if (!v.sale_id || (v.kind !== "invoice" && v.kind !== "credit_note")) continue;
      const numberText = v.sales_point && v.number ? ` ${String(v.sales_point).padStart(5, "0")}-${String(v.number).padStart(8, "0")}` : "";
      if (v.kind === "invoice") voucherBySale.set(v.sale_id, `${v.voucher_class ? `Factura ${v.voucher_class}` : "Factura"}${numberText}`);
      else creditNoteBySale.set(v.sale_id, `${v.voucher_class ? `Nota de crédito ${v.voucher_class}` : "Nota de crédito"}${numberText}`);
    }
    rows = sales.map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      customerName: s.customer_id ? (names.get(s.customer_id) ?? "Cliente eliminado") : "Consumidor Final",
      paymentMethod: s.payment_method,
      total: Number(s.total),
      voided: s.status === "anulada",
      internalNumber: s.internal_number,
      voucher: voucherBySale.get(s.id) ?? null,
      creditNote: creditNoteBySale.get(s.id) ?? null,
      sellerName: s.user_id ? (memberLabels?.get(s.user_id) ?? "Usuario eliminado") : null,
    }));

    // Totales de TODO el filtro (no sólo de la página): vendido, facturado y sin facturar.
    if (!e) {
      try {
        const all = await fetchAll((from, to) =>
          filtered("id, total, status, payment_method", false).order("id").range(from, to)
        );
        const authorized = await fetchAllIn(
          all.map((r) => (r as unknown as { id: string }).id),
          (ids, from, to) =>
            supabase
              .from("arca_vouchers")
              .select("sale_id, kind")
              .in("sale_id", ids)
              .eq("status", "authorized")
              .eq("kind", "invoice")
              .order("id")
              .range(from, to)
        );
        const invoiced = new Set(authorized.map((v) => v.sale_id));
        const sum: VentasSummary = {
          count: 0, vendido: 0, facturadoCount: 0, facturado: 0, sinFacturarCount: 0, sinFacturar: 0,
          anuladasCount: 0, anuladas: 0, fiado: 0,
        };
        for (const r of all as unknown as { id: string; total: number; status: string; payment_method: string }[]) {
          const t = Number(r.total);
          if (r.status === "anulada") {
            sum.anuladasCount += 1;
            sum.anuladas += t;
            continue;
          }
          sum.count += 1;
          sum.vendido += t;
          if (r.payment_method === "fiado") sum.fiado += t;
          if (invoiced.has(r.id)) {
            sum.facturadoCount += 1;
            sum.facturado += t;
          } else {
            sum.sinFacturarCount += 1;
            sum.sinFacturar += t;
          }
        }
        summary = sum;
      } catch {
        summary = null;
      }
    }
  }

  const invoicing = await getInvoicingConfig(organization.id).catch(() => ({ enabled: false, autoMethods: [] as string[] }));

  return (
    <div className="space-y-6">
      <ReportesTabs active="ventas" />
      <PeriodSelector
        query={periodQuery}
        sellerId={null}
        rangeLabel={range.label.replace(/^del |^el /, "")}
        today={argDateString()}
        canCustomRange={canCustomRange}
        canCompare={false}
        showCompare={false}
        basePath="/ventas"
        extraParams={{ medio, estado, comprobante, vendedor, min: minAmount !== null ? String(minAmount) : "", max: maxAmount !== null ? String(maxAmount) : "", q, sucursal, ...(pageSize !== 25 ? { tam: String(pageSize) } : {}) }}
      />
      <VentasHistorial
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        filters={{ desde, hasta, medio, estado, comprobante, vendedor, min: minAmount !== null ? String(minAmount) : "", max: maxAmount !== null ? String(maxAmount) : "", q, sucursal }}
        summary={summary}
        sellers={memberLabels ? Array.from(memberLabels, ([id, name]) => ({ id, name })) : []}
        periodQuery={periodParams(periodQuery).toString()}
        paymentLabels={paymentLabels}
        branches={hasBranches ? branchContext.branches.map((b) => ({ id: b.id, name: b.name })) : []}
        canVoid={admin}
        canExport={admin}
        canInvoice={invoicing.enabled}
        orgName={organization.ticket_show_org_name === false ? "" : organization.name}
        ticketShowNumber={organization.ticket_show_number !== false}
        error={error}
      />
    </div>
  );
}
