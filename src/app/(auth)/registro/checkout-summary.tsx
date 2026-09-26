import { CreditCard, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { planIcons, planAccents } from "@/lib/plan-visuals";
import { ANNUAL_DISCOUNT, planDefinitions } from "@/lib/plan-features";
import type { Plan } from "@/lib/subscription";

// Resumen del plan elegido en precios (en /registro y en /suscribirse):
// después de crear la cuenta se paga con Mercado Pago (débito automático)
// y recién ahí se entra a Pesito.
export function CheckoutSummary({ plan, annual }: { plan: Plan; annual: boolean }) {
  const def = planDefinitions[plan];
  const Icon = planIcons[plan];
  const accent = planAccents[plan];
  const monthlyPrice = def.price;
  const annualMonthlyPrice = Math.round(def.price * (1 - ANNUAL_DISCOUNT));
  const displayedPrice = annual ? annualMonthlyPrice : monthlyPrice;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              accent.iconBg
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>{def.name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {annual ? "Facturación anual" : "Facturación mensual"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-foreground">
              {formatCurrency(displayedPrice)}
            </span>
            <span className="text-sm text-muted-foreground">por mes</span>
          </div>
          {annual && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(annualMonthlyPrice * 12)} facturados una vez al año
            </p>
          )}
          {annual && (
            <p className="mt-0.5 text-xs font-medium text-success">
              Ahorrás {formatCurrency(monthlyPrice * 12 - annualMonthlyPrice * 12)} al año pagando
              anual
            </p>
          )}
        </div>

        <div className="rounded-xl bg-accent/40 p-4 text-sm">
          <p className="font-medium text-accent-foreground">Cómo sigue</p>
          <p className="mt-1 text-accent-foreground/80">
            {`Creás tu cuenta, pagás el ${def.name} en Mercado Pago y entrás a Pesito con el plan activo. Se renueva solo ${annual ? "cada año" : "cada mes"}.`}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Método de pago
          </p>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3.5">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              MercadoPago
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">Débito automático</span>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Pagás con tarjeta o con tu cuenta de Mercado Pago. Cancelás cuando quieras desde
            Configuración.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
