"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Radio, Store, Trophy, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/dashboard/bar-chart";
import { paymentLabels } from "@/lib/payment-labels";
import { cn, formatCurrency, formatTime } from "@/lib/utils";
import {
  parseLiveOverview,
  type LiveClosedRegister,
  type LiveMember,
  type LiveOpenRegister,
  type LiveOverview,
} from "@/lib/live-overview";

const REFRESH_MS = 30_000;
// Un vendedor con la caja abierta que lleva más que esto sin vender se
// marca, para que el dueño lo vea de un vistazo.
const IDLE_WARNING_MS = 30 * 60_000;

function minutesAgo(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

function agoLabel(iso: string, now: number) {
  const m = minutesAgo(iso, now);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h ${m % 60} min`;
}

function durationLabel(iso: string, now: number) {
  const m = minutesAgo(iso, now);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function deltaPct(today: number, yesterday: number) {
  return yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null;
}

// Una persona dentro de una sucursal: lo que vendió ahí hoy y sus cajas de
// esa sucursal (la abierta y las que cerró hoy).
interface BranchMember {
  member: LiveMember;
  label: string;
  salesCount: number;
  salesTotal: number;
  lastSaleAt: string | null;
  openRegister: LiveOpenRegister | null;
  closedRegisters: LiveClosedRegister[];
}

interface BranchView {
  id: string;
  name: string;
  count: number;
  total: number;
  yesterdayTotal: number | null;
  openRegisters: number;
  members: BranchMember[];
}

export function LiveClient({
  orgId,
  orgName,
  currentUserId,
  initial,
}: {
  orgId: string;
  orgName: string;
  currentUserId: string;
  initial: LiveOverview;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState(false);
  // "Ahora" arranca en el momento en que el servidor armó los datos (así el
  // primer render coincide con el del servidor) y después avanza solo.
  const [now, setNow] = useState(() => new Date(initial.generated_at).getTime());
  const supabase = useMemo(() => createClient(), []);
  const loading = useRef(false);

  useEffect(() => {
    async function refresh() {
      if (loading.current) return;
      loading.current = true;
      const { data: next, error: rpcError } = await supabase.rpc("live_overview", {
        p_org_id: orgId,
      });
      loading.current = false;
      if (rpcError || !next) {
        setError(true);
        return;
      }
      setError(false);
      setData(parseLiveOverview(next));
    }

    // Se actualiza cada 30 s sólo mientras la pantalla está a la vista. Si
    // la pestaña queda en segundo plano no se consulta nada; al volver se
    // actualiza en el momento y retoma cada 30 s.
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (timer) return;
      timer = setInterval(refresh, REFRESH_MS);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    const clock = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      stop();
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [orgId, supabase]);

  const labelFor = (m: LiveMember) =>
    m.user_id === currentUserId ? "Vos" : m.label ?? "Usuario eliminado";

  // Sucursales con su gente. Sin sucursales en la base (0043 sin aplicar)
  // se muestra todo el equipo como un solo bloque.
  const branchViews: BranchView[] = (() => {
    const branches = data.branches ?? [];
    if (branches.length === 0) {
      return [
        {
          id: "all",
          name: orgName,
          count: data.today.count,
          total: data.today.total,
          yesterdayTotal: data.yesterday_same_time.total,
          openRegisters: data.members.filter((m) => m.open_register).length,
          members: data.members.map((m) => ({
            member: m,
            label: labelFor(m),
            salesCount: m.sales_count,
            salesTotal: Number(m.sales_total),
            lastSaleAt: m.last_sale_at,
            openRegister: m.open_register,
            closedRegisters: m.closed_today,
          })),
        },
      ];
    }
    const mainId = branches.find((b) => b.is_main)?.id ?? branches[0].id;
    return branches.map((b) => {
      const members: BranchMember[] = [];
      for (const m of data.members) {
        const sold = m.by_branch?.[b.id];
        const open =
          m.open_register && (m.open_register.branch_id ?? m.branch_id ?? mainId) === b.id
            ? m.open_register
            : null;
        const closed = m.closed_today.filter(
          (c) => (c.branch_id ?? m.branch_id ?? mainId) === b.id
        );
        const belongs = (m.branch_id ?? mainId) === b.id;
        if (!belongs && !sold && !open && closed.length === 0) continue;
        members.push({
          member: m,
          label: labelFor(m),
          salesCount: sold?.count ?? 0,
          salesTotal: Number(sold?.total ?? 0),
          lastSaleAt: sold?.last_sale_at ?? null,
          openRegister: open,
          closedRegisters: closed,
        });
      }
      members.sort(
        (a, c) =>
          Number(Boolean(c.openRegister)) - Number(Boolean(a.openRegister)) ||
          c.salesTotal - a.salesTotal
      );
      return {
        id: b.id,
        name: b.name,
        count: b.count,
        total: Number(b.total),
        yesterdayTotal: Number(b.yesterday_total),
        openRegisters: b.open_registers,
        members,
      };
    });
  })();
  const multiBranch = branchViews.length > 1;
  const topBranchId = multiBranch
    ? [...branchViews].sort((a, b) => b.total - a.total)[0]?.id
    : null;
  const branchName = new Map(branchViews.map((b) => [b.id, b.name]));

  const ticket = data.today.count > 0 ? data.today.total / data.today.count : 0;
  const businessDelta = deltaPct(data.today.total, data.yesterday_same_time.total);
  const openCount = data.members.filter((m) => m.open_register).length;

  const currentHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(now)
  );
  // Desde las 8 (o antes, si hubo ventas más temprano) hasta la hora actual.
  const firstHour = Math.min(8, ...data.by_hour.map((v, h) => (v > 0 ? h : 24)));
  const hourChart = data.by_hour
    .map((value, hour) => ({ label: `${hour}h`, value }))
    .slice(firstHour, Math.max(firstHour + 1, currentHour + 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Radio className="h-4 w-4 animate-pulse text-success" />
          Hoy, en vivo · actualizado {agoLabel(data.generated_at, now)}
        </p>
        {error && (
          <p className="text-sm text-danger">No pudimos actualizar. Reintentamos en 30 segundos.</p>
        )}
      </div>

      {/* 1. Negocio */}
      <section className="space-y-3">
        <SectionTitle icon={Building2}>{orgName}</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Vendido hoy" value={formatCurrency(data.today.total)}>
            <Delta pct={businessDelta} />
          </Stat>
          <Stat label="Ventas" value={String(data.today.count)}>
            <span className="text-muted-foreground">
              Ayer a esta hora: {data.yesterday_same_time.count}
            </span>
          </Stat>
          <Stat label="Ticket promedio" value={formatCurrency(ticket)} />
          <Stat label="Cajas abiertas" value={String(openCount)}>
            <span className="text-muted-foreground">
              {multiBranch ? `en ${branchViews.length} sucursales` : `de ${data.members.length} personas`}
            </span>
          </Stat>
        </div>
      </section>

      {/* 2. Sucursales → 3. vendedores → cajas */}
      <section className="space-y-3">
        {multiBranch && <SectionTitle icon={Store}>Sucursales</SectionTitle>}
        <div className="space-y-4">
          {branchViews.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              showHeader={multiBranch}
              isTop={b.id === topBranchId && b.total > 0}
              now={now}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por hora</CardTitle>
          </CardHeader>
          <CardContent>
            {data.today.count === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay ventas hoy.</p>
            ) : (
              <BarChart data={hourChart} showValueLabels={false} labelEvery={2} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas ventas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recent_sales.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Todavía no hay ventas hoy.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.recent_sales.map((s) => {
                  const seller = data.members.find((m) => m.user_id === s.user_id);
                  return (
                    <div key={s.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {formatTime(s.created_at)} · {seller ? labelFor(seller) : "Usuario eliminado"}
                          {multiBranch && s.branch_id && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {branchName.get(s.branch_id)}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.items || "Sin detalle"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(s.total)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {paymentLabels[s.payment_method] ?? s.payment_method}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </h2>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground">Ayer a esta hora no había ventas</span>;
  return (
    <span className={pct >= 0 ? "text-success" : "text-danger"}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs ayer a esta hora
    </span>
  );
}

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {children && <p className="text-xs">{children}</p>}
      </CardContent>
    </Card>
  );
}

function BranchCard({
  branch,
  showHeader,
  isTop,
  now,
}: {
  branch: BranchView;
  showHeader: boolean;
  isTop: boolean;
  now: number;
}) {
  const ticket = branch.count > 0 ? branch.total / branch.count : 0;
  const pct = branch.yesterdayTotal === null ? null : deltaPct(branch.total, branch.yesterdayTotal);

  return (
    <Card className={cn(isTop && "border-success")}>
      {showHeader && (
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-muted-foreground" />
              {branch.name}
              {isTop && (
                <Badge tone="success" className="gap-1">
                  <Trophy className="h-3 w-3" />
                  La que más vende hoy
                </Badge>
              )}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {branch.count} {branch.count === 1 ? "venta" : "ventas"} · ticket{" "}
              {formatCurrency(ticket)} · {branch.openRegisters}{" "}
              {branch.openRegisters === 1 ? "caja abierta" : "cajas abiertas"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-foreground">{formatCurrency(branch.total)}</p>
            <p className="text-xs">
              <Delta pct={pct} />
            </p>
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {!showHeader && (
          <p className="px-5 pt-5 text-sm font-semibold text-foreground">Vendedores</p>
        )}
        {branch.members.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">Nadie trabaja hoy en esta sucursal.</p>
        ) : (
          <div className="divide-y divide-border">
            {branch.members.map((m) => (
              <SellerRow key={m.member.user_id} seller={m} now={now} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SellerRow({ seller, now }: { seller: BranchMember; now: number }) {
  const open = seller.openRegister;
  const idle =
    open !== null &&
    now - new Date(seller.lastSaleAt ?? open.opened_at).getTime() > IDLE_WARNING_MS;
  const hasCaja = open !== null || seller.closedRegisters.length > 0;

  return (
    <div className="space-y-2 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                open ? "bg-success" : "bg-muted-foreground/40"
              )}
            />
            {seller.label}
            {idle && (
              <Badge tone="warning">
                Sin vender {agoLabel(seller.lastSaleAt ?? open!.opened_at, now)}
              </Badge>
            )}
          </p>
          {!hasCaja && <p className="mt-1 text-xs text-muted-foreground">Sin caja hoy</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-foreground">{formatCurrency(seller.salesTotal)}</p>
          <p className="text-xs text-muted-foreground">
            {seller.salesCount} {seller.salesCount === 1 ? "venta" : "ventas"} hoy
            {seller.lastSaleAt && ` · última ${agoLabel(seller.lastSaleAt, now)}`}
          </p>
        </div>
      </div>

      {hasCaja && (
        <div className="space-y-1.5 pl-4">
          {open && (
            <CajaLine
              tone="open"
              title={`Caja abierta hace ${durationLabel(open.opened_at, now)}`}
              detail={[
                open.cash !== null ? `${formatCurrency(Number(open.cash))} en caja` : null,
                open.sales_total !== undefined
                  ? `vendió ${formatCurrency(Number(open.sales_total))} en ${open.sales_count} ${
                      open.sales_count === 1 ? "venta" : "ventas"
                    }`
                  : null,
              ]}
            />
          )}
          {seller.closedRegisters.map((c, i) => {
            const diff = Number(c.difference);
            return (
              <CajaLine
                key={c.id ?? i}
                tone={diff < 0 ? "danger" : "closed"}
                title={`Caja cerrada ${c.opened_at ? `${formatTime(c.opened_at)}–` : "a las "}${formatTime(c.closed_at)}`}
                detail={[
                  c.sales_total !== undefined
                    ? `vendió ${formatCurrency(Number(c.sales_total))} en ${c.sales_count} ${
                        c.sales_count === 1 ? "venta" : "ventas"
                      }`
                    : null,
                  diff < 0
                    ? `faltante de ${formatCurrency(-diff)}`
                    : diff > 0
                      ? `sobrante de ${formatCurrency(diff)}`
                      : "sin diferencias",
                ]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CajaLine({
  tone,
  title,
  detail,
}: {
  tone: "open" | "closed" | "danger";
  title: string;
  detail: (string | null)[];
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <Wallet
        className={cn(
          "h-3.5 w-3.5",
          tone === "open" ? "text-success" : tone === "danger" ? "text-danger" : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "font-medium",
          tone === "open" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground"
        )}
      >
        {title}
      </span>
      {detail.filter(Boolean).map((d) => (
        <span key={d}>· {d}</span>
      ))}
    </p>
  );
}
