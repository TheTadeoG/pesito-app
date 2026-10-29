import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { isOrgAdmin } from "@/lib/roles";
import { getBranchContext } from "@/lib/branches";
import { ReportesTabs } from "@/components/dashboard/reportes-tabs";
import { VentasHistorial, type HistorialRow } from "./ventas-historial";

const paymentLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  qr: "QR",
  mixto: "Mixto",
  fiado: "Fiado",
};
const PAGE_SIZES = [25, 50, 100, 200];
const DAY = 24 * 60 * 60 * 1000;

/** Hoy en Argentina (UTC-3, sin horario de verano) como YYYY-MM-DD. */
const argDay = (offsetDays = 0) => new Date(Date.now() - 3 * 60 * 60 * 1000 - offsetDays * DAY).toISOString().slice(0, 10);
const isDay = (v: string | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; medio?: string; estado?: string; q?: string; pagina?: string; tam?: string; sucursal?: string }>;
}) {
  const sp = await searchParams;
  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const admin = isOrgAdmin(membership.role);

  const desde = isDay(sp.desde) ? sp.desde : argDay(29);
  const hasta = isDay(sp.hasta) ? sp.hasta : argDay(0);
  const medio = sp.medio && paymentLabels[sp.medio] ? sp.medio : "";
  const estado = sp.estado === "completada" || sp.estado === "anulada" ? sp.estado : "";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const pageSize = PAGE_SIZES.includes(Number(sp.tam)) ? Number(sp.tam) : 25;
  const page = Math.max(0, Math.floor(Number(sp.pagina) || 0));
  const branchContext = await getBranchContext();
  const hasBranches = admin && branchContext.branches.length > 1;
  const sucursal = hasBranches && branchContext.branches.some((b) => b.id === sp.sucursal) ? (sp.sucursal as string) : "";

  // Búsqueda por nombre de cliente: primero los clientes que coinciden.
  let customerIds: string[] | null = null;
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ");
    const { data: found } = await supabase.from("customers").select("id").eq("org_id", organization.id).ilike("name", `%${safe}%`).limit(150);
    customerIds = (found ?? []).map((c) => c.id);
  }

  let rows: HistorialRow[] = [];
  let total = 0;
  let error: string | null = null;
  if (!(customerIds && customerIds.length === 0)) {
    let query = supabase
      .from("sales")
      .select("id, created_at, total, payment_method, invoice_type, status, customer_id", { count: "exact" })
      .eq("org_id", organization.id)
      .gte("created_at", `${desde}T00:00:00-03:00`)
      .lte("created_at", `${hasta}T23:59:59.999-03:00`)
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (medio) query = query.eq("payment_method", medio as "efectivo");
    if (estado) query = query.eq("status", estado);
    if (sucursal) query = query.eq("branch_id", sucursal);
    if (customerIds) query = query.in("customer_id", customerIds);
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
    for (const v of vouchers.data ?? []) {
      if (!v.sale_id || v.kind !== "invoice") continue;
      voucherBySale.set(v.sale_id, `${v.voucher_class ? `Factura ${v.voucher_class}` : "Factura"}${v.sales_point && v.number ? ` ${String(v.sales_point).padStart(5, "0")}-${String(v.number).padStart(8, "0")}` : ""}`);
    }
    rows = sales.map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      customerName: s.customer_id ? (names.get(s.customer_id) ?? "Cliente eliminado") : "Consumidor Final",
      paymentMethod: s.payment_method,
      total: Number(s.total),
      voided: s.status === "anulada",
      voucher: voucherBySale.get(s.id) ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      <ReportesTabs active="ventas" />
      <VentasHistorial
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      filters={{ desde, hasta, medio, estado, q, sucursal }}
      paymentLabels={paymentLabels}
      branches={hasBranches ? branchContext.branches.map((b) => ({ id: b.id, name: b.name })) : []}
      canVoid={admin}
      canExport={admin}
      orgName={organization.name}
      error={error}
      />
    </div>
  );
}
