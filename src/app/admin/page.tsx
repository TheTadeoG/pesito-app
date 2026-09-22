import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Package,
  Receipt,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrgPlanManager } from "@/app/admin/org-plan-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, type BarChartDatum } from "@/components/dashboard/bar-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { cn, formatCurrency } from "@/lib/utils";
import { businessTypes } from "@/lib/business-types";
import { ARG_TZ, argDateString, argMidnightUTC } from "@/lib/timezone";
import { paymentLabels } from "@/lib/payment-labels";
import { roleLabels } from "@/lib/roles";

const businessTypeLabels: Record<string, string> = Object.fromEntries(
  businessTypes.map((t) => [t.value, t.label])
);

const DAY_MS = 24 * 60 * 60 * 1000;

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: ARG_TZ,
  }).format(date);
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ARG_TZ,
  }).format(new Date(iso));
}

function bucketByDay<T>(
  rows: T[],
  getDate: (row: T) => string,
  days: number,
  getValue: (row: T) => number = () => 1
): BarChartDatum[] {
  const todayMidnight = argMidnightUTC(argDateString());
  const start = new Date(todayMidnight);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const buckets = Array.from({ length: days }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    return date;
  });

  return buckets.map((date) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 1);
    const value = rows
      .filter((r) => {
        const created = new Date(getDate(r));
        return created >= date && created < next;
      })
      .reduce((acc, r) => acc + getValue(r), 0);
    return { label: dayLabel(date), value };
  });
}

const tileIcons = {
  store: Store,
  users: Users,
  dollar: DollarSign,
  receipt: Receipt,
  trending: TrendingUp,
  check: CheckCircle2,
  wallet: Wallet,
  bag: ShoppingBag,
  clock: Clock,
  userPlus: UserPlus,
};

export default async function AdminPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [
    { data: orgsRaw },
    { data: subscriptionsRaw },
    { data: salesRaw },
    { data: purchasesRaw },
    { data: membershipRows },
    { data: fiadoRows },
    { count: productsCount },
    { count: customersCount },
    { count: suppliersCount },
    { count: openRegistersCount },
  ] = await Promise.all([
    admin.from("organizations").select("id, name, business_type, created_at"),
    admin.from("organization_subscriptions").select("org_id, plan, pro_trial_ends_at"),
    // Tope de 20.000 ventas más recientes: de sobra para esta etapa. Si la
    // plataforma crece mucho más, esto pasa a subestimar el total histórico
    // y conviene mover los totales a una función agregada en SQL.
    admin
      .from("sales")
      .select("id, org_id, total, payment_method, created_at")
      .eq("status", "completada")
      .order("created_at", { ascending: false })
      .limit(20000),
    admin.from("purchases").select("id, total").eq("status", "completada"),
    admin.from("memberships").select("user_id, org_id, role"),
    admin.from("customers").select("balance").gt("balance", 0),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("customers").select("id", { count: "exact", head: true }),
    admin.from("suppliers").select("id", { count: "exact", head: true }),
    admin
      .from("cash_registers")
      .select("id", { count: "exact", head: true })
      .eq("status", "abierta"),
  ]);

  // auth.users no se puede leer con .from() ni siquiera con la service role;
  // hay que paginar con la Admin API. Con un tope de 20 páginas (20.000
  // usuarios) alcanza de sobra para esta etapa del producto.
  const users: { id: string; created_at: string; last_sign_in_at: string | null }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    users.push(
      ...data.users.map((u) => ({
        id: u.id,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }))
    );
    if (!data.nextPage) break;
  }

  const organizations = orgsRaw ?? [];
  const subscriptionByOrgId = new Map(
    (subscriptionsRaw ?? []).map((s) => [s.org_id, { plan: s.plan, proTrialEndsAt: s.pro_trial_ends_at }])
  );
  const sales = (salesRaw ?? []).map((s) => ({ ...s, total: Number(s.total) }));
  const purchases = (purchasesRaw ?? []).map((p) => ({ ...p, total: Number(p.total) }));
  const memberships = membershipRows ?? [];
  const membersWithOrg = new Set(memberships.map((m) => m.user_id));

  const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
  const totalSales = sales.length;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const totalPurchaseAmount = purchases.reduce((acc, p) => acc + p.total, 0);
  const totalFiadoPending = (fiadoRows ?? []).reduce((acc, c) => acc + Number(c.balance), 0);

  const paymentTotals = new Map<string, number>();
  for (const s of sales) {
    paymentTotals.set(s.payment_method, (paymentTotals.get(s.payment_method) ?? 0) + s.total);
  }
  const paymentBreakdown = Array.from(paymentTotals.entries())
    .map(([method, value]) => ({ label: paymentLabels[method] ?? method, value }))
    .sort((a, b) => b.value - a.value);

  const orgNameById = new Map(organizations.map((o) => [o.id, o.name]));
  const revenueByOrg = new Map<string, number>();
  // Las ventas vienen ordenadas por fecha desc, así que la primera vez que
  // aparece cada org_id es su venta más reciente.
  const lastSaleByOrg = new Map<string, string>();
  for (const s of sales) {
    revenueByOrg.set(s.org_id, (revenueByOrg.get(s.org_id) ?? 0) + s.total);
    if (!lastSaleByOrg.has(s.org_id)) lastSaleByOrg.set(s.org_id, s.created_at);
  }
  const topOrgs = Array.from(revenueByOrg.entries())
    .map(([orgId, total]) => ({ name: orgNameById.get(orgId) ?? "Negocio eliminado", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const activeOrgs7d = new Set(
    sales
      .filter((s) => now - new Date(s.created_at).getTime() <= 7 * DAY_MS)
      .map((s) => s.org_id)
  ).size;
  const activeOrgs30d = new Set(
    sales
      .filter((s) => now - new Date(s.created_at).getTime() <= 30 * DAY_MS)
      .map((s) => s.org_id)
  ).size;

  const businessTypeTotals = new Map<string, number>();
  for (const org of organizations) {
    const key = org.business_type || "otro";
    businessTypeTotals.set(key, (businessTypeTotals.get(key) ?? 0) + 1);
  }
  const businessTypeBreakdown = Array.from(businessTypeTotals.entries())
    .map(([type, value]) => ({ label: businessTypeLabels[type] ?? type, value }))
    .sort((a, b) => b.value - a.value);

  const revenueChart = bucketByDay(sales, (s) => s.created_at, 30, (s) => s.total);
  const signupsChart = bucketByDay(organizations, (o) => o.created_at, 30);

  const totalUsers = users.length;
  const usersWithOrg = users.filter((u) => membersWithOrg.has(u.id)).length;
  const onboardingRate = totalUsers > 0 ? (usersWithOrg / totalUsers) * 100 : 0;

  // "En línea" de verdad necesitaría presencia en tiempo real (websockets);
  // esto es la mejor aproximación posible con lo que ya tenemos: último
  // login de cada usuario.
  const activeLastHour = users.filter(
    (u) => u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() <= 60 * 60 * 1000
  ).length;
  const activeToday = users.filter(
    (u) => u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() <= DAY_MS
  ).length;

  const weekRevenue = sales
    .filter((s) => now - new Date(s.created_at).getTime() <= 7 * DAY_MS)
    .reduce((acc, s) => acc + s.total, 0);
  const prevWeekRevenue = sales
    .filter((s) => {
      const age = now - new Date(s.created_at).getTime();
      return age > 7 * DAY_MS && age <= 14 * DAY_MS;
    })
    .reduce((acc, s) => acc + s.total, 0);
  const weekGrowthPct =
    prevWeekRevenue > 0 ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 : null;

  // Activación: negocios que se dieron de alta pero todavía no cargaron
  // ninguna venta. Buen indicador de a quién ayudar a arrancar.
  const neverSoldOrgs = organizations
    .filter((o) => !revenueByOrg.has(o.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // En riesgo: llevan más de 14 días de alta y no venden hace más de 14
  // días (o nunca vendieron).
  const atRiskOrgs = organizations
    .filter((o) => now - new Date(o.created_at).getTime() > 14 * DAY_MS)
    .map((o) => {
      const lastSale = lastSaleByOrg.get(o.id);
      const daysInactive = lastSale
        ? Math.floor((now - new Date(lastSale).getTime()) / DAY_MS)
        : Math.floor((now - new Date(o.created_at).getTime()) / DAY_MS);
      return { name: o.name, daysInactive, everSold: Boolean(lastSale) };
    })
    .filter((o) => o.daysInactive > 14)
    .sort((a, b) => b.daysInactive - a.daysInactive)
    .slice(0, 10);

  const teamsByOrg = new Map<string, number>();
  const roleTotals = new Map<string, number>();
  for (const m of memberships) {
    teamsByOrg.set(m.org_id, (teamsByOrg.get(m.org_id) ?? 0) + 1);
    roleTotals.set(m.role, (roleTotals.get(m.role) ?? 0) + 1);
  }
  const orgsWithTeam = Array.from(teamsByOrg.values()).filter((n) => n > 1).length;
  const roleBreakdown = Array.from(roleTotals.entries())
    .map(([role, value]) => ({ label: roleLabels[role as keyof typeof roleLabels] ?? role, value }))
    .sort((a, b) => b.value - a.value);

  const recentOrgs = [...organizations]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map((o) => ({ ...o, hasSold: revenueByOrg.has(o.id) }));

  const orgsForPlanManager = [...organizations]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((o) => ({
      id: o.id,
      name: o.name,
      plan: subscriptionByOrgId.get(o.id)?.plan ?? "gratis",
      proTrialEndsAt: subscriptionByOrgId.get(o.id)?.proTrialEndsAt ?? null,
    }));

  const recentSales = sales.slice(0, 15).map((s) => ({
    ...s,
    orgName: orgNameById.get(s.org_id) ?? "Negocio eliminado",
  }));

  const tiles: { icon: keyof typeof tileIcons; label: string; value: string }[] = [
    { icon: "store", label: "Negocios registrados", value: String(organizations.length) },
    { icon: "users", label: "Usuarios registrados", value: String(totalUsers) },
    { icon: "dollar", label: "Ingresos totales", value: formatCurrency(totalRevenue) },
    { icon: "receipt", label: "Ventas totales", value: String(totalSales) },
    { icon: "trending", label: "Ticket promedio", value: formatCurrency(avgTicket) },
    {
      icon: "check",
      label: "Completaron el alta",
      value: `${onboardingRate.toFixed(0)}% (${usersWithOrg}/${totalUsers})`,
    },
    { icon: "wallet", label: "Cajas abiertas ahora", value: String(openRegistersCount ?? 0) },
    {
      icon: "bag",
      label: "Compras registradas",
      value: `${purchases.length} · ${formatCurrency(totalPurchaseAmount)}`,
    },
  ];

  const activityTiles: { icon: keyof typeof tileIcons; label: string; value: string }[] = [
    { icon: "clock", label: "Activos última hora", value: String(activeLastHour) },
    { icon: "userPlus", label: "Activos hoy", value: String(activeToday) },
    { icon: "wallet", label: "Fiado pendiente (plataforma)", value: formatCurrency(totalFiadoPending) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Estado de Pesito</h1>
        <p className="text-sm text-muted-foreground">
          Estadísticas de toda la plataforma, en tiempo real.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tileIcons[tile.icon];
          return (
            <Card key={tile.label}>
              <CardContent className="flex items-center gap-3 py-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
                  <p className="truncate text-lg font-bold text-foreground">{tile.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {activityTiles.map((tile) => {
          const Icon = tileIcons[tile.icon];
          return (
            <Card key={tile.label}>
              <CardContent className="flex items-center gap-3 py-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
                  <p className="truncate text-lg font-bold text-foreground">{tile.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                weekGrowthPct === null
                  ? "bg-accent text-accent-foreground"
                  : weekGrowthPct >= 0
                    ? "bg-success-bg text-success"
                    : "bg-danger-bg text-danger"
              )}
            >
              {weekGrowthPct !== null && weekGrowthPct < 0 ? (
                <TrendingDown className="h-5 w-5" />
              ) : (
                <TrendingUp className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                Ingresos esta semana vs. anterior
              </p>
              <p className="truncate text-lg font-bold text-foreground">
                {formatCurrency(weekRevenue)}
                {weekGrowthPct !== null && (
                  <span
                    className={cn(
                      "ml-1.5 text-sm font-semibold",
                      weekGrowthPct >= 0 ? "text-success" : "text-danger"
                    )}
                  >
                    {weekGrowthPct >= 0 ? "+" : ""}
                    {weekGrowthPct.toFixed(0)}%
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Negocios activos (con ventas)</p>
              <p className="text-lg font-bold text-foreground">
                {activeOrgs7d} <span className="text-sm font-normal text-muted-foreground">últimos 7 días</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {activeOrgs30d} en los últimos 30 días
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Catálogo cargado en total</p>
              <p className="text-sm text-foreground">
                <Package className="mr-1 inline h-3.5 w-3.5" />
                {productsCount ?? 0} productos · {customersCount ?? 0} clientes ·{" "}
                <Truck className="mr-1 inline h-3.5 w-3.5" />
                {suppliersCount ?? 0} proveedores
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos por día (últimos 30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChart.every((d) => d.value === 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin ventas todavía.</p>
            ) : (
              <BarChart data={revenueChart} labelEvery={3} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Negocios nuevos por día (últimos 30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {signupsChart.every((d) => d.value === 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Sin negocios nuevos todavía.
              </p>
            ) : (
              <BarChart
                data={signupsChart}
                showValueLabels={false}
                labelEvery={3}
                formatValue={(v) => String(v)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medios de pago (global)</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin ventas todavía.</p>
            ) : (
              <DonutChart data={paymentBreakdown} formatValue={formatCurrency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipo de negocio</CardTitle>
          </CardHeader>
          <CardContent>
            {businessTypeBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Sin negocios todavía.
              </p>
            ) : (
              <DonutChart data={businessTypeBreakdown} formatValue={(v) => String(v)} />
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">Activación y retención</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Nunca vendieron ({neverSoldOrgs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {neverSoldOrgs.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Todos los negocios ya hicieron al menos una venta.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {neverSoldOrgs.slice(0, 8).map((org) => (
                    <div
                      key={org.id}
                      className="flex items-center justify-between px-5 py-2.5 text-sm"
                    >
                      <span className="truncate text-foreground">{org.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        alta: {formatDateTime(org.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Negocios en riesgo ({atRiskOrgs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {atRiskOrgs.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Nadie lleva más de 14 días sin vender.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {atRiskOrgs.map((org) => (
                    <div
                      key={org.name}
                      className="flex items-center justify-between px-5 py-2.5 text-sm"
                    >
                      <span className="truncate text-foreground">{org.name}</span>
                      <Badge tone="warning">
                        {org.everSold ? `${org.daysInactive}d sin vender` : "nunca vendió"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">Equipos</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <UsersRound className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Negocios con más de 1 usuario</p>
                <p className="text-lg font-bold text-foreground">
                  {orgsWithTeam}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    de {organizations.length} ({organizations.length > 0 ? ((orgsWithTeam / organizations.length) * 100).toFixed(0) : 0}%)
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roles en toda la plataforma</CardTitle>
            </CardHeader>
            <CardContent>
              {roleBreakdown.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin datos.</p>
              ) : (
                <DonutChart data={roleBreakdown} formatValue={(v) => String(v)} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Negocios con más ventas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topOrgs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Sin ventas todavía.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {topOrgs.map((org, i) => (
                <div
                  key={`${org.name}-${i}`}
                  className="flex items-center justify-between px-5 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    {org.name}
                  </span>
                  <span className="font-semibold text-foreground">{formatCurrency(org.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos negocios registrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrgs.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Sin negocios todavía.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {recentOrgs.map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {businessTypeLabels[org.business_type] ?? org.business_type} ·{" "}
                        {formatDateTime(org.created_at)}
                      </p>
                    </div>
                    <Badge tone={org.hasSold ? "success" : "default"}>
                      {org.hasSold ? "Ya vendió" : "Pendiente"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Planes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <OrgPlanManager orgs={orgsForPlanManager} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentSales.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Sin ventas todavía.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {recentSales.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{s.orgName}</p>
                      <p className="text-xs text-muted-foreground">
                        {paymentLabels[s.payment_method] ?? s.payment_method} ·{" "}
                        {formatDateTime(s.created_at)}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-foreground">
                      {formatCurrency(s.total)}
                    </span>
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
