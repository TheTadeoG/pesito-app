import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INVOICE_PACKS, formatCount } from "@/lib/invoice-packs";
import { formatCurrency } from "@/lib/utils";
import type { Plan, SubscriptionInfo } from "@/lib/subscription";
import type { InvoiceUsage } from "@/lib/invoice-usage";

// Paquetes de facturas electrónicas por mes, para contratar o cambiar desde Planes. Se cobran y renuevan junto con el
// plan: elegir uno lleva al pago del mismo plan con ese paquete.
export function InvoicePacksSection({
  subscription,
  usage,
  canManage,
}: {
  subscription: SubscriptionInfo;
  usage: InvoiceUsage | null;
  canManage: boolean;
}) {
  const paidPlan: Plan =
    subscription.plan !== "gratis" ? subscription.plan : subscription.billing?.paidPlan && subscription.billing.paidPlan !== "gratis" ? subscription.billing.paidPlan : "basico";
  const hasPlan = subscription.plan !== "gratis";
  const cycle = subscription.billing?.cycle ?? "mensual";
  const href = (pack: number) => `/suscribirse?plan=${paidPlan}&ciclo=${cycle}&paquete=${pack}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturas electrónicas</CardTitle>
        <CardDescription>
          Los planes no incluyen facturas: se contratan con un paquete por mes, que se cobra y se renueva junto con el plan. Las notas de crédito cuentan como factura. Sin cupo, las ventas siguen como comprobante X (no fiscal).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usage && (
          <p className="flex items-center gap-2 text-sm text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {usage.quota > 0
              ? `Este mes usaste ${formatCount(usage.used)} de ${formatCount(usage.quota)} facturas.`
              : "Todavía no tenés un paquete de facturas."}
          </p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {INVOICE_PACKS.map((p) => {
            const mine = hasPlan && subscription.invoicePack === p.size;
            const action = hasPlan ? (subscription.invoicePack > 0 ? "Cambiar" : "Sumar") : "Elegir";
            const body = (
              <>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{`${formatCount(p.size)} facturas por mes`}</p>
                  <p className="text-xs text-muted-foreground">{`${formatCurrency(p.price)} por mes · IVA incl.`}</p>
                </div>
                {mine ? (
                  <Badge tone="success">Tu paquete</Badge>
                ) : canManage ? (
                  <span className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{action}</span>
                ) : null}
              </>
            );
            const base = "flex items-center justify-between gap-3 rounded-xl border px-4 py-3";
            return (
              <li key={p.size}>
                {!mine && canManage ? (
                  <Link
                    href={href(p.size)}
                    prefetch={false}
                    className={`${base} border-border transition-colors hover:border-primary hover:bg-primary/5`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={`${base} ${mine ? "border-primary bg-primary/5" : "border-border"}`}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          {hasPlan
            ? `Si ya pagás tu plan con débito automático, el plan no se vuelve a cobrar: al subir de paquete pagás aparte sólo lo que resta del período, y desde el próximo cobro el débito incluye plan y paquete. Si lo bajás, rige desde el próximo cobro.`
            : "Se contrata junto con un plan pago, desde el Plan Básico."}
        </p>
      </CardContent>
    </Card>
  );
}
