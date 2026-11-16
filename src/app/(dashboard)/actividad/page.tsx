import Link from "next/link";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import { getMemberLabelsById } from "@/lib/member-labels";
import { Card, CardContent } from "@/components/ui/card";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { getBranchContext } from "@/lib/branches";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { cn } from "@/lib/utils";
import { ReportesTabs } from "@/components/dashboard/reportes-tabs";
import { ActividadClient, type ActivityEvent, type UserSummary } from "@/app/(dashboard)/actividad/actividad-client";

const PERIODS = [
  { days: 1, label: "Hoy" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
];

const num = (v: unknown) => Number(v ?? 0) || 0;

export default async function ActividadPage({ searchParams }: { searchParams: Promise<{ dias?: string; desde?: string; hasta?: string; sucursal?: string }> }) {
  const { organization, membership } = await requireOrgContext();

  if (membership.role !== "owner" && membership.role !== "admin") {
    return (
      <div className="space-y-5">
        <ReportesTabs active="actividad" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Sólo el dueño o un administrador pueden ver el control por usuario.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "userActivity")) {
    return (
      <div className="space-y-5">
        <ReportesTabs active="actividad" />
        <ProLockedCard
          title="Control por usuario"
          plan={featureMinPlan.userActivity}
          preview="list"
          description="Mirá qué hizo cada persona de tu equipo: ventas anuladas, ajustes de stock, retiros e ingresos de caja y diferencias al cerrar."
        />
      </div>
    );
  }

  const params = await searchParams;
  // Fechas a medida (desde/hasta, hasta 92 días) o un atajo (Hoy / 7 / 30 días). Todo en hora de Argentina (UTC-3).
  const DAY = 86_400_000;
  const AR = 3 * 3600_000;
  const dateParam = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? Date.parse(v) + AR : null);
  const fromCustom = dateParam(params.desde);
  const toCustom = dateParam(params.hasta);
  const custom = fromCustom !== null && toCustom !== null && toCustom >= fromCustom && toCustom - fromCustom <= 92 * DAY;
  const days = PERIODS.some((p) => String(p.days) === params.dias) ? Number(params.dias) : 7;
  // eslint-disable-next-line react-hooks/purity -- Server Component: se calcula fresco en cada request.
  const nowMs = Date.now();
  const arStart = Math.floor((nowMs - AR) / DAY) * DAY + AR;
  const sinceMs = custom ? (fromCustom as number) : arStart - (days - 1) * DAY;
  const untilMs = custom ? (toCustom as number) + DAY : arStart + DAY;
  const since = new Date(sinceMs).toISOString();
  const until = new Date(untilMs).toISOString();
  const rangeLabel = `${new Date(sinceMs - AR).toISOString().slice(0, 10)} a ${new Date(untilMs - AR - DAY).toISOString().slice(0, 10)}`;
  const fromInput = custom ? params.desde : "";
  const toInput = custom ? params.hasta : "";
  const orgId = organization.id;
  const branchContext = await getBranchContext();
  const multiBranch = branchContext.branches.length > 1;
  const branchId = multiBranch && branchContext.branches.some((b) => b.id === params.sucursal) ? (params.sucursal as string) : null;
  const branchNames = new Map(branchContext.branches.map((b) => [b.id, b.name]));
  const branchOf = (id: string | null) => (multiBranch && id ? branchNames.get(id) ?? null : null);
  // Con una sucursal elegida se filtra cada tabla por su branch_id (la de movimientos de caja, por las cajas de esa sucursal).
  const inBranch = <T extends { eq: (c: string, v: string) => T }>(q: T): T => (branchId ? q.eq("branch_id", branchId) : q);

  const [labels, sales, stock, cashMoves, registers] = await Promise.all([
    getMemberLabelsById(supabase, orgId),
    fetchAll((from, to) =>
      inBranch(supabase
        .from("sales")
        .select("id, user_id, total, status, created_at, voided_at, voided_by, void_reason, internal_number, branch_id")
        .eq("org_id", orgId))
        .or(`and(created_at.gte.${since},created_at.lt.${until}),and(voided_at.gte.${since},voided_at.lt.${until})`)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      inBranch(supabase
        .from("stock_movements")
        .select("id, type, quantity, reference, user_id, created_at, product_id, branch_id")
        .eq("org_id", orgId))
        .neq("type", "venta")
        .gte("created_at", since)
        .lt("created_at", until)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from("cash_movements")
        .select("id, type, amount, reason, user_id, created_at, cash_register_id")
        .eq("org_id", orgId)
        .gte("created_at", since)
        .lt("created_at", until)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      inBranch(supabase
        .from("cash_registers")
        .select("id, user_id, opening_amount, closing_amount, expected_amount, status, opened_at, closed_at, branch_id")
        .eq("org_id", orgId))
        .or(`and(opened_at.gte.${since},opened_at.lt.${until}),and(closed_at.gte.${since},closed_at.lt.${until})`)
        .order("id")
        .range(from, to)
    ),
  ]);

  const productNames = new Map(
    (
      await fetchAllIn(
        stock.map((m) => m.product_id),
        (ids, from, to) => supabase.from("products").select("id, name").in("id", ids).order("id").range(from, to)
      )
    ).map((p) => [p.id, p.name])
  );

  const registerBranch = new Map(
    multiBranch
      ? (
          await fetchAllIn(
            cashMoves.map((c) => c.cash_register_id),
            (ids, from, to) => supabase.from("cash_registers").select("id, branch_id").in("id", ids).order("id").range(from, to)
          )
        ).map((g) => [g.id, g.branch_id])
      : []
  );
  const cashMovesShown = branchId ? cashMoves.filter((c) => registerBranch.get(c.cash_register_id) === branchId) : cashMoves;

  const label = (id: string | null) => (id ? labels.get(id) ?? "Usuario eliminado" : "Sistema");
  const summaries = new Map<string, UserSummary>();
  const row = (id: string | null): UserSummary => {
    const key = id ?? "sistema";
    let s = summaries.get(key);
    if (!s) {
      s = {
        userId: key,
        label: label(id),
        sales: 0,
        salesTotal: 0,
        voids: 0,
        stockAdjustments: 0,
        cashIn: 0,
        cashOut: 0,
        registersClosed: 0,
        cashDifference: 0,
        shortages: 0,
      };
      summaries.set(key, s);
    }
    return s;
  };
  // Los miembros actuales aparecen siempre, aunque no hayan hecho nada.
  for (const id of labels.keys()) row(id);

  const events: ActivityEvent[] = [];
  const inRange = (iso: string | null) => iso !== null && iso >= since && iso < until;

  for (const s of sales) {
    if (inRange(s.created_at) && s.status !== "anulada") {
      const r = row(s.user_id);
      r.sales += 1;
      r.salesTotal += num(s.total);
    }
    if (s.status === "anulada" && s.voided_at && inRange(s.voided_at)) {
      row(s.voided_by).voids += 1;
      events.push({
        id: `void-${s.id}`,
        userId: s.voided_by ?? "sistema",
        at: s.voided_at,
        kind: "anulacion",
        title: `Anuló una venta de ${money(num(s.total))}${s.internal_number ? ` (n.º ${s.internal_number})` : ""}`,
        detail: s.void_reason ? `Motivo: ${s.void_reason}` : null,
        tone: "danger",
        branch: branchOf(s.branch_id),
      });
    }
  }

  for (const m of stock) {
    const q = num(m.quantity);
    const name = productNames.get(m.product_id) ?? "Producto eliminado";
    if (m.type === "ajuste") row(m.user_id).stockAdjustments += 1;
    const kind = m.type === "compra" ? "Compra" : m.type === "apertura" ? "Stock inicial" : m.type === "transferencia" ? "Transferencia" : "Ajuste de stock";
    events.push({
      id: `stock-${m.id}`,
      userId: m.user_id ?? "sistema",
      at: m.created_at,
      kind: "stock",
      title: `${kind}: ${name} (${q > 0 ? "+" : ""}${q.toLocaleString("es-AR")})`,
      detail: m.reference,
      tone: m.type === "ajuste" && q < 0 ? "warning" : "neutral",
      branch: branchOf(m.branch_id),
    });
  }

  for (const c of cashMovesShown) {
    const amount = num(c.amount);
    const r = row(c.user_id);
    if (c.type === "retiro") r.cashOut += amount;
    else r.cashIn += amount;
    events.push({
      id: `cash-${c.id}`,
      userId: c.user_id,
      at: c.created_at,
      kind: "caja",
      title: `${c.type === "retiro" ? "Retiró" : "Ingresó"} ${money(amount)} de la caja`,
      detail: c.reason ? `Motivo: ${c.reason}` : null,
      tone: c.type === "retiro" ? "warning" : "neutral",
      branch: branchOf(registerBranch.get(c.cash_register_id) ?? null),
    });
  }

  for (const g of registers) {
    if (inRange(g.opened_at)) {
      events.push({
        id: `open-${g.id}`,
        userId: g.user_id,
        at: g.opened_at,
        kind: "caja",
        title: `Abrió la caja con ${money(num(g.opening_amount))}`,
        detail: null,
        tone: "neutral",
        branch: branchOf(g.branch_id),
      });
    }
    if (g.status === "cerrada" && g.closed_at && inRange(g.closed_at) && g.closing_amount !== null && g.expected_amount !== null) {
      const diff = Math.round((num(g.closing_amount) - num(g.expected_amount)) * 100) / 100;
      const r = row(g.user_id);
      r.registersClosed += 1;
      r.cashDifference += diff;
      if (diff < 0) r.shortages += 1;
      events.push({
        id: `close-${g.id}`,
        userId: g.user_id,
        at: g.closed_at,
        kind: "caja",
        title: `Cerró la caja: contó ${money(num(g.closing_amount))}, esperaba ${money(num(g.expected_amount))}`,
        detail: diff === 0 ? "Sin diferencia." : diff < 0 ? `Faltaron ${money(-diff)}.` : `Sobraron ${money(diff)}.`,
        tone: diff < 0 ? "danger" : diff > 0 ? "warning" : "success",
        branch: branchOf(g.branch_id),
      });
    }
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const users = Array.from(summaries.values())
    .map((u) => ({ ...u, salesTotal: Math.round(u.salesTotal), cashDifference: Math.round(u.cashDifference * 100) / 100 }))
    .sort((a, b) => b.salesTotal - a.salesTotal || a.label.localeCompare(b.label));

  return (
    <div className="space-y-5">
      <ReportesTabs active="actividad" />
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={`/actividad?dias=${p.days}${branchId ? `&sucursal=${branchId}` : ""}`}
            prefetch={false}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              !custom && p.days === days ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </Link>
        ))}
        <form action="/actividad" className="flex flex-wrap items-center gap-2 sm:ml-2">
          <input type="hidden" name="dias" value={days} />
          {multiBranch && (
            <select name="sucursal" defaultValue={branchId ?? ""} aria-label="Sucursal" className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground">
              <option value="">Todas las sucursales</option>
              {branchContext.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Desde
            <input type="date" name="desde" defaultValue={fromInput} className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground" />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Hasta
            <input type="date" name="hasta" defaultValue={toInput} className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground" />
          </label>
          <button type="submit" className={cn("h-9 rounded-lg border px-3 text-sm font-medium", custom ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted")}>
            Aplicar
          </button>
        </form>
      </div>
      {(params.desde || params.hasta) && !custom && (
        <p className="text-xs text-warning">Elegí las dos fechas (desde no puede ser después de hasta, y hasta 92 días): mostramos los últimos 7 días.</p>
      )}
      <ActividadClient users={users} events={events} periodKey={`${since}|${until}|${branchId ?? ""}`} rangeLabel={rangeLabel} />
    </div>
  );
}

function money(n: number): string {
  return `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}
