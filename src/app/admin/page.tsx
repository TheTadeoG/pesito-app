import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminData } from "@/lib/admin-data";
import { DAY_MS, SEGMENTS, ago, inSegment, whatsappNumber, type AdminOrg, type SegmentId } from "@/lib/admin-shared";
import { computeFunnel, formatDuration } from "@/lib/admin-funnel";
import { ANNUAL_DISCOUNT, planDefinitions } from "@/lib/plan-features";
import { planLabels, type Plan } from "@/lib/subscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, type BarChartDatum } from "@/components/dashboard/bar-chart";
import { ARG_TZ, argDateString, argMidnightUTC } from "@/lib/timezone";
import { cn, formatCurrency } from "@/lib/utils";

export const metadata = { title: "Resumen" };

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: ARG_TZ }).format(date);
}

function signupsByDay(orgs: AdminOrg[], days: number): BarChartDatum[] {
  const start = new Date(argMidnightUTC(argDateString()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return Array.from({ length: days }, (_, i) => {
    const from = new Date(start);
    from.setUTCDate(from.getUTCDate() + i);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    const value = orgs.filter((o) => {
      const t = new Date(o.createdAt);
      return t >= from && t < to;
    }).length;
    return { label: dayLabel(from), value };
  });
}

function PlanChip({ org }: { org: AdminOrg }) {
  let label = planLabels[org.plan as Plan] ?? org.plan;
  let tone = "bg-muted text-muted-foreground";
  if (org.paymentStatus === "past_due") {
    label = `${label} (cobro fallido)`;
    tone = "bg-danger-bg text-danger";
  } else if (org.plan !== "gratis") {
    tone = "bg-success-bg text-success";
  } else if (org.trialEndsAt) {
    // eslint-disable-next-line react-hooks/purity -- Server Component: se calcula fresco en cada request.
    const left = new Date(org.trialEndsAt).getTime() - Date.now();
    label = left > 0 ? "Prueba Pro" : "Prueba vencida";
    tone = left > 0 ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger";
  }
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}>{label}</span>;
}

function whatDid(o: AdminOrg): { text: string; tone: string } {
  if (o.saleCount > 0) return { text: `${o.saleCount} ${o.saleCount === 1 ? "venta" : "ventas"}`, tone: "text-success" };
  if (o.productCount > 0) return { text: `${o.productCount} productos, sin ventas`, tone: "text-warning" };
  return { text: "Sólo se registró", tone: "text-warning" };
}

export default async function AdminResumenPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const data = await loadAdminData();
  const { orgs } = data;
  // eslint-disable-next-line react-hooks/purity -- Server Component: se calcula fresco en cada request.
  const now = Date.now();

  const [{ data: activityRows }, { data: historyRows }] = await Promise.all([
    admin.from("platform_org_activity").select("*"),
    admin.from("plan_history").select("org_id, from_plan, to_plan, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  const count = (seg: SegmentId) => orgs.filter((o) => inSegment(o, seg, now)).length;
  const paying = count("pagan");
  const inTrial = count("en-prueba");
  const trialEnding = count("prueba-por-vencer");
  const newWeek = count("nuevos");
  const noSales = count("sin-vender");
  const stopped = count("dejaron");
  const failed = count("cobro-fallido");
  const soldThisWeek = orgs.filter((o) => o.lastSaleAt && now - new Date(o.lastSaleAt).getTime() <= 7 * DAY_MS).length;

  const funnel = activityRows
    ? computeFunnel({
        signedUpOwners: orgs.length + data.signedUpWithoutOrg,
        activity: activityRows.map((a) => ({ ...a, sale_count: Number(a.sale_count), member_count: Number(a.member_count) })),
        subscriptions: new Map(orgs.map((o) => [o.id, { plan: o.plan, trialEndsAt: o.trialEndsAt, paidViaMp: o.paidViaMp, cycle: (o.cycle as "mensual" | "anual" | null) ?? null }])),
        monthlyPrice: (plan, cycle) => {
          const price = planDefinitions[plan as Plan]?.price ?? 0;
          return cycle === "anual" ? Math.round(price * (1 - ANNUAL_DISCOUNT)) : price;
        },
      })
    : null;

  const kpis: { label: string; value: string; note: string; tone?: string; money?: boolean }[] = [
    { label: "Negocios", value: String(orgs.length), note: `+${newWeek} esta semana`, tone: "text-success" },
    { label: "Pagan", value: String(paying), note: orgs.length ? `${Math.round((paying / orgs.length) * 100)}% de los negocios` : "—" },
    { label: "Ingreso mensual", value: funnel ? formatCurrency(funnel.mrr) : "—", note: "Estimado, de los que pagan por Mercado Pago", money: true },
    { label: "En prueba gratis", value: String(inTrial), note: trialEnding ? `${trialEnding} vencen en 3 días` : "Ninguna vence pronto", tone: trialEnding ? "text-warning" : undefined },
    { label: "Vendieron esta semana", value: String(soldThisWeek), note: orgs.length ? `${Math.round((soldThisWeek / orgs.length) * 100)}% de los negocios` : "—" },
    { label: "Sin ninguna venta", value: String(noSales), note: "Se registraron y no vendieron" },
  ];

  const attention: { title: string; sub: string; n: number; seg: SegmentId; tone: string }[] = [
    { title: "Pruebas que vencen", sub: "En los próximos 3 días", n: trialEnding, seg: "prueba-por-vencer", tone: "border-l-warning" },
    { title: "Se registraron y no vendieron", sub: "Todavía sin una venta", n: noSales, seg: "sin-vender", tone: "border-l-primary" },
    { title: "Cobros fallidos", sub: "En período de gracia", n: failed, seg: "cobro-fallido", tone: "border-l-danger" },
    { title: "Dejaron de vender", sub: "Vendían y pararon hace 14 días o más", n: stopped, seg: "dejaron", tone: "border-l-warning" },
  ];

  // Movimiento reciente: altas, primeras ventas y cambios de plan.
  const nameById = new Map(orgs.map((o) => [o.id, o.name]));
  const feed: { at: string; who: string; what: string }[] = [
    ...orgs.slice(0, 12).map((o) => ({ at: o.createdAt, who: o.name, what: "se registró" })),
    ...orgs.filter((o) => o.firstSaleAt).map((o) => ({ at: o.firstSaleAt!, who: o.name, what: "hizo su primera venta" })),
    ...(historyRows ?? []).map((h) => ({
      at: h.created_at,
      who: nameById.get(h.org_id) ?? "Un negocio",
      what: `pasó de ${planLabels[h.from_plan as Plan] ?? h.from_plan} a ${planLabels[h.to_plan as Plan] ?? h.to_plan}`,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const recent = orgs.slice(0, 10);
  const signups = signupsByDay(orgs, 30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Resumen</h1>
        <p className="text-sm text-muted-foreground">Qué pasó, quién necesita atención y cómo va el embudo.</p>
      </div>

      {!data.hasLastSale && (
        <p className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-foreground">
          Falta aplicar la migración 0091 en Supabase: sin ella no se sabe cuándo vendió cada negocio por última vez ni se pueden guardar notas.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="space-y-1 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className={cn("text-3xl font-bold leading-none text-foreground", k.money && "admin-sensitive")}>{k.value}</p>
              <p className={cn("text-sm text-muted-foreground", k.tone)}>{k.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-baseline justify-between gap-2">
            <CardTitle className="text-base">Embudo: de registrarse a pagar</CardTitle>
            <Link href="/admin/contenido" className="text-sm font-medium text-primary hover:underline">Ver el detalle</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel ? (
              <>
                {funnel.steps.map((s, i) => {
                  const top = funnel.steps[0]?.count || 1;
                  return (
                    <div key={s.label} className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-3 text-sm">
                      <span className="font-medium text-foreground">{s.label}</span>
                      <div className="h-6 overflow-hidden rounded-lg bg-muted">
                        <div className="h-full rounded-lg bg-primary" style={{ width: `${Math.max(2, (s.count / top) * 100)}%`, opacity: 0.45 + 0.55 * (1 - i / Math.max(1, funnel.steps.length)) }} />
                      </div>
                      <span className="text-right text-foreground">
                        <b>{s.count}</b>
                        {i > 0 && s.pctPrev !== null && <span className="text-muted-foreground">{` · ${Math.round(s.pctPrev)}%`}</span>}
                      </span>
                    </div>
                  );
                })}
                <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-foreground">
                  {(() => {
                    let worst = 1;
                    for (let i = 2; i < funnel.steps.length; i++) {
                      if ((funnel.steps[i].pctPrev ?? 100) < (funnel.steps[worst].pctPrev ?? 100)) worst = i;
                    }
                    const step = funnel.steps[worst];
                    const prev = funnel.steps[worst - 1];
                    return step && prev
                      ? `Donde más se pierde la gente: de “${prev.label}” a “${step.label}” (${prev.count - step.count} negocios no pasaron). Tiempo típico hasta la primera venta: ${formatDuration(funnel.medianHoursToFirstSale)}.`
                      : "Todavía no hay suficientes datos para ver dónde se pierde la gente.";
                  })()}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Falta aplicar la migración 0075 para ver el embudo.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Para atender hoy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {attention.map((a) => (
              <Link
                key={a.seg}
                href={`/admin/negocios?seg=${a.seg}`}
                className={cn("flex items-center justify-between gap-3 rounded-xl border border-border border-l-4 px-3 py-2.5 transition-colors hover:bg-muted/50", a.tone)}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.sub}</span>
                </span>
                <span className="text-2xl font-bold text-foreground">{a.n}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-baseline justify-between gap-2">
            <CardTitle className="text-base">Altas por día</CardTitle>
            <span className="text-xs text-muted-foreground">Últimos 30 días · {newWeek} en la última semana</span>
          </CardHeader>
          <CardContent>
            {signups.every((d) => d.value === 0) ? <p className="py-10 text-center text-sm text-muted-foreground">Sin altas en el período.</p> : <BarChart data={signups} labelEvery={5} formatValue={(v) => String(v)} emptyLabel="Sin altas" />}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Movimiento reciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {feed.length === 0 && <p className="text-sm text-muted-foreground">Sin movimiento todavía.</p>}
            {feed.map((e, i) => (
              <p key={`${e.at}-${i}`} className="grid grid-cols-[72px_1fr] gap-2 text-sm leading-snug">
                <span className="text-muted-foreground">{ago(e.at, now)}</span>
                <span className="text-foreground">
                  <b className="admin-sensitive">{e.who}</b> {e.what}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-baseline justify-between gap-2">
          <CardTitle className="text-base">Quiénes se registraron</CardTitle>
          <Link href="/admin/negocios" className="text-sm font-medium text-primary hover:underline">Ver todos los negocios</Link>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <div className="min-w-[860px] divide-y divide-border text-sm">
            <div className="grid grid-cols-[2fr_1fr_1fr_1.4fr_1fr_1.4fr] gap-3 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <span>Negocio</span><span>Alta</span><span>Plan</span><span>Qué hizo</span><span>Última venta</span><span>Contactar</span>
            </div>
            {recent.map((o) => {
              const wa = whatsappNumber(o.phone);
              const did = whatDid(o);
              return (
                <div key={o.id} className="grid grid-cols-[2fr_1fr_1fr_1.4fr_1fr_1.4fr] items-center gap-3 px-5 py-2.5">
                  <Link href={`/admin/negocios?org=${o.id}`} className="min-w-0">
                    <span className="admin-sensitive block truncate font-semibold text-foreground hover:underline">{o.name}</span>
                    <span className="admin-sensitive block truncate text-xs text-muted-foreground">{`${o.type}${o.ownerName ? ` · ${o.ownerName}` : ""}`}</span>
                  </Link>
                  <span className="text-muted-foreground">{ago(o.createdAt, now)}</span>
                  <span><PlanChip org={o} /></span>
                  <span className={did.tone}>{did.text}</span>
                  <span className="text-muted-foreground">{o.lastSaleAt ? ago(o.lastSaleAt, now) : "—"}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {wa && (
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted">WhatsApp</a>
                    )}
                    {o.ownerEmail && (
                      <a href={`mailto:${o.ownerEmail}`} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted">Mail</a>
                    )}
                    <Link href={`/admin/negocios?org=${o.id}`} className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">Ver ficha</Link>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {`Segmentos disponibles en Negocios: ${SEGMENTS.map((s) => s.label).join(", ")}. Las visitas a la web se miran en Google Analytics.`}
      </p>
    </div>
  );
}
