import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { formatDuration, type FunnelResult } from "@/lib/admin-funnel";

const fmtPct = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);

/**
 * Embudo de activación (de registrarse a pagar), la prueba Pro y qué usan los negocios que ya
 * venden. Todo sobre negocios, no empleados. El número clave es "hicieron una venta".
 */
export function FunnelSection({ funnel }: { funnel: FunnelResult | null }) {
  if (!funnel) {
    return (
      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">Embudo de activación</h2>
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Falta aplicar la migración 0075 (<code>platform_org_activity</code>) en Supabase para ver el embudo.
          </CardContent>
        </Card>
      </div>
    );
  }
  const top = funnel.steps[0]?.count || 1;
  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-foreground">Embudo de activación y prueba Pro</h2>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">De registrarse a pagar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.steps.map((s, i) => (
              <div key={s.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{s.count}</span>
                    {i > 0 && ` · ${fmtPct(s.pctPrev)} del paso anterior · ${fmtPct(s.pctFirst)} del total`}
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }} />
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              {`Tiempo típico hasta la primera venta: ${formatDuration(funnel.medianHoursToFirstSale)} (mediana desde que crearon el negocio). La que importa: de los que crean el negocio, cuántos venden.`}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prueba Pro y pagos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="En prueba hoy" value={String(funnel.trial.active)} />
              <Stat label="Vencen en 3 días o menos" value={String(funnel.trial.endingSoon)} />
              <Stat label="Vencieron sin pagar" value={String(funnel.trial.expiredUnpaid)} />
              <Stat label="Pasaron a pagar" value={String(funnel.trial.converted)} />
              <Stat label="Conversión de la prueba" value={fmtPct(funnel.trial.conversionPct)} hint="pagaron ÷ (pagaron + vencieron sin pagar)" />
              <Stat label="Ingreso mensual estimado" value={formatCurrency(funnel.mrr)} hint={`${funnel.payingOrgs} negocios pagan`} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{`Qué usan los que ya venden (${funnel.sellingOrgs} negocios)`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {funnel.sellingOrgs === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía ningún negocio hizo una venta.</p>
          ) : (
            funnel.adoption.map((a) => (
              <div key={a.label} className="flex items-center gap-3 text-sm">
                <span className="w-52 shrink-0 text-foreground">{a.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${a.pct}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-muted-foreground">{`${a.count} · ${fmtPct(a.pct)}`}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
