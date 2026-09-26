"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { planLabels, type BillingCycle, type Plan } from "@/lib/subscription";
import { useMercadoPagoCheckout } from "@/app/(dashboard)/configuracion/use-mp-checkout";

export function SubscribeButton({
  plan,
  planName,
  monthlyPrice,
  annualPrice,
  variant,
  label,
}: {
  plan: Plan;
  planName: string;
  monthlyPrice: number;
  /** Total que se cobra una vez por año. */
  annualPrice: number;
  variant: React.ComponentProps<typeof Button>["variant"];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("mensual");
  const router = useRouter();
  const { status, error, checkoutUrl, activePlan, start, check, reset } = useMercadoPagoCheckout("configuracion");

  function close() {
    setOpen(false);
    if (status === "active") router.refresh();
    reset();
  }

  const options: { value: BillingCycle; title: string; price: string; note: string }[] = [
    { value: "mensual", title: "Mensual", price: `${formatCurrency(monthlyPrice)} por mes`, note: "Se debita todos los meses." },
    {
      value: "anual",
      title: "Anual (20% menos)",
      price: `${formatCurrency(annualPrice)} por año`,
      note: `Equivale a ${formatCurrency(Math.round(annualPrice / 12))} por mes. Se debita una vez al año.`,
    },
  ];

  return (
    <>
      <Button variant={variant} size="sm" className="w-full" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={`Contratar el ${planName}`}
        description="Se paga con Mercado Pago, con débito automático. Cancelás cuando quieras desde acá."
      >
        {status === "active" ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 rounded-xl bg-success-bg px-3 py-3 font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" />
              {`¡Pago confirmado! Ya tenés el Plan ${planLabels[activePlan ?? plan]}.`}
            </p>
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                Listo
              </Button>
            </div>
          </div>
        ) : status === "waiting" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Esperando tu pago en Mercado Pago…
            </p>
            <p className="text-sm text-muted-foreground">
              Terminá el pago en la pestaña de Mercado Pago. Cuando se confirme, lo vas a ver acá.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {checkoutUrl && (
                <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="ghost">
                    Volver a abrir Mercado Pago
                  </Button>
                </a>
              )}
              <Button type="button" variant="outline" onClick={check}>
                Ya pagué
              </Button>
            </div>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setCycle(o.value)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  cycle === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
              >
                <p className="text-sm font-semibold text-foreground">{o.title}</p>
                <p className="text-sm text-foreground">{o.price}</p>
                <p className="mt-1 text-xs text-muted-foreground">{o.note}</p>
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Te llevamos al checkout de Mercado Pago: pagás con tarjeta o entrando a tu cuenta de
            Mercado Pago, y volvés a Pesito con el plan activo.
          </p>

          {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => start(plan, cycle)} disabled={status === "opening"}>
              {status === "opening" ? "Conectando…" : "Ir a Mercado Pago"}
            </Button>
          </div>
        </div>
        )}
      </Dialog>
    </>
  );
}
