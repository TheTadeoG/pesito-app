"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Radio, Store, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/dashboard/bar-chart";
import { paymentLabels } from "@/lib/payment-labels";
import { cn, formatCurrency, formatTime } from "@/lib/utils";
import { parseLiveOverview, type LiveMember, type LiveOverview } from "@/lib/live-overview";

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

export function LiveClient({
  orgId,
  currentUserId,
  initial,
}: {
  orgId: string;
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
  // Sucursal elegida en el ranking (null = todas).
  const [branchId, setBranchId] = useState<string | null>(null);

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

  const labelById = new Map(
    data.members.map((m) => [
      m.user_id,
      m.user_id === currentUserId ? "Vos" : m.label ?? "Usuario eliminado",
    ])
  );
  const branches = data.branches ?? [];
  const multiBranch = branches.length > 1;
  const selectedBranch = multiBranch ? branches.find((b) => b.id === branchId) ?? null : null;
  // Con una sucursal elegida: quien trabaja ahí o vendió ahí hoy, con lo
  // vendido sólo en esa sucursal.
  const members = selectedBranch
    ? data.members
        .filter((m) => m.branch_id === selectedBranch.id || m.by_branch?.[selectedBranch.id])
        .map((m) => {
          const inBranch = m.by_branch?.[selectedBranch.id];
          return {
            ...m,
            sales_count: inBranch?.count ?? 0,
            sales_total: inBranch?.total ?? 0,
            last_sale_at: inBranch?.last_sale_at ?? null,
            open_register:
              m.open_register && m.branch_id === selectedBranch.id ? m.open_register : null,
          };
        })
    : data.members;
  const recentSales = selectedBranch
    ? data.recent_sales.filter((s) => s.branch_id === selectedBranch.id)
    : data.recent_sales;
  const today = selectedBranch
    ? { count: selectedBranch.count, total: Number(selectedBranch.total) }
    : data.today;
  const yesterday = selectedBranch
    ? Number(selectedBranch.yesterday_total)
    : data.yesterday_same_time.total;
  const byHour = selectedBranch ? selectedBranch.by_hour : data.by_hour;
  const openCount = members.filter((m) => m.open_register).length;
  const ticket = today.count > 0 ? today.total / today.count : 0;
  const deltaPct = yesterday > 0 ? ((today.total - yesterday) / yesterday) * 100 : null;
  const topBranchId = multiBranch
    ? [...branches].sort((a, b) => Number(b.total) - Number(a.total))[0]?.id
    : null;
  const currentHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(now)
  );
  // Desde las 8 (o antes, si hubo ventas más temprano) hasta la hora actual.
  const firstHour = Math.min(8, ...byHour.map((v, h) => (v > 0 ? h : 24)));
  const hourChart = byHour
    .map((value, hour) => ({ label: `${hour}h`, value }))
    .slice(firstHour, Math.max(firstHour + 1, currentHour + 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Radio className="h-4 w-4 animate-pulse text-success" />
          Hoy, en vivo{selectedBranch ? ` · ${selectedBranch.name}` : ""} · actualizado{" "}
          {agoLabel(data.generated_at, now)}
        </p>
        {error && (
          <p className="text-sm text-danger">
            No pudimos actualizar. Reintentamos en 30 segundos.
          </p>
        )}
      </div>

      {multiBranch && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Sucursales</CardTitle>
            <button
              type="button"
              onClick={() => setBranchId(null)}
              className={cn(
                "rounded-lg px-3 py-1 text-sm font-medium",
                selectedBranch ? "text-primary hover:bg-muted" : "bg-muted text-foreground"
              )}
            >
              Todas
            </button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => {
              const bDelta =
                Number(b.yesterday_total) > 0
                  ? ((Number(b.total) - Number(b.yesterday_total)) / Number(b.yesterday_total)) * 100
                  : null;
              const active = selectedBranch?.id === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBranchId(active ? null : b.id)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40",
                    b.id === topBranchId && Number(b.total) > 0 && !active && "border-success bg-success-bg"
                  )}
                >
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    {b.name}
                    {b.id === topBranchId && Number(b.total) > 0 && (
                      <Trophy className="h-3.5 w-3.5 text-success" aria-label="La que más vende hoy" />
                    )}
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(Number(b.total))}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.count} {b.count === 1 ? "venta" : "ventas"} · {b.open_registers}{" "}
                    {b.open_registers === 1 ? "caja abierta" : "cajas abiertas"}
                  </p>
                  {bDelta !== null && (
                    <p className={cn("text-xs", bDelta >= 0 ? "text-success" : "text-danger")}>
                      {bDelta >= 0 ? "▲" : "▼"} {Math.abs(bDelta).toFixed(0)}% vs ayer a esta hora
                    </p>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Vendido hoy" value={formatCurrency(today.total)}>
          {deltaPct === null ? (
            <span className="text-muted-foreground">Ayer a esta hora no había ventas</span>
          ) : (
            <span className={deltaPct >= 0 ? "text-success" : "text-danger"}>
              {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(0)}% vs ayer a esta hora
            </span>
          )}
        </Stat>
        <Stat label="Ventas" value={String(today.count)}>
          {!selectedBranch && (
            <span className="text-muted-foreground">
              Ayer a esta hora: {data.yesterday_same_time.count}
            </span>
          )}
        </Stat>
        <Stat label="Ticket promedio" value={formatCurrency(ticket)} />
        <Stat label="Cajas abiertas" value={String(openCount)}>
          <span className="text-muted-foreground">de {members.length} personas del equipo</span>
        </Stat>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {members.length === 0 && (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                Nadie trabaja hoy en esta sucursal.
              </p>
            )}
            {members.map((m) => (
              <MemberRow
                key={m.user_id}
                member={m}
                label={labelById.get(m.user_id)!}
                branchName={
                  multiBranch && !selectedBranch
                    ? branches.find((b) => b.id === m.branch_id)?.name ?? null
                    : null
                }
                now={now}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por hora</CardTitle>
          </CardHeader>
          <CardContent>
            {today.count === 0 ? (
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
            {recentSales.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Todavía no hay ventas hoy.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentSales.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {formatTime(s.created_at)} · {labelById.get(s.user_id) ?? "Usuario eliminado"}
                        {multiBranch && !selectedBranch && s.branch_id && (
                          <span className="font-normal text-muted-foreground">
                            {" "}· {branches.find((b) => b.id === s.branch_id)?.name}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.items || "Sin detalle"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(s.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {paymentLabels[s.payment_method] ?? s.payment_method}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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

function MemberRow({
  member,
  label,
  branchName,
  now,
}: {
  member: LiveMember;
  label: string;
  branchName: string | null;
  now: number;
}) {
  const register = member.open_register;
  const idle =
    register !== null &&
    now - new Date(member.last_sale_at ?? register.opened_at).getTime() > IDLE_WARNING_MS;
  const closedDiff = member.closed_today.reduce((acc, c) => acc + Number(c.difference), 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <span
            className={register ? "h-2 w-2 rounded-full bg-success" : "h-2 w-2 rounded-full bg-muted-foreground/40"}
          />
          {label}
          {branchName && <span className="text-xs font-normal text-muted-foreground">· {branchName}</span>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {register ? (
            <>
              <Badge tone="success">Caja abierta hace {durationLabel(register.opened_at, now)}</Badge>
              {register.cash !== null && <span>{formatCurrency(Number(register.cash))} en caja</span>}
            </>
          ) : member.closed_today.length > 0 ? (
            <Badge tone={closedDiff < 0 ? "danger" : "default"}>
              Cerró caja
              {closedDiff < 0
                ? ` con faltante de ${formatCurrency(-closedDiff)}`
                : closedDiff > 0
                  ? ` con sobrante de ${formatCurrency(closedDiff)}`
                  : " sin diferencias"}
            </Badge>
          ) : (
            <Badge>Sin caja hoy</Badge>
          )}
          {idle && <Badge tone="warning">Sin vender {agoLabel(member.last_sale_at ?? register!.opened_at, now)}</Badge>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold text-foreground">{formatCurrency(Number(member.sales_total))}</p>
        <p className="text-xs text-muted-foreground">
          {member.sales_count} {member.sales_count === 1 ? "venta" : "ventas"}
          {member.last_sale_at && ` · última ${agoLabel(member.last_sale_at, now)}`}
        </p>
      </div>
    </div>
  );
}
