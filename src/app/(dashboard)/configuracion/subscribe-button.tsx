"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency } from "@/lib/utils";
import type { BillingCycle, Plan } from "@/lib/subscription";
import { startSubscription } from "@/app/(dashboard)/configuracion/billing-actions";

export function SubscribeButton({
  plan,
  planName,
  monthlyPrice,
  annualPrice,
  defaultEmail,
  variant,
  label,
}: {
  plan: Plan;
  planName: string;
  monthlyPrice: number;
  /** Total que se cobra una vez por año. */
  annualPrice: number;
  defaultEmail: string;
  variant: React.ComponentProps<typeof Button>["variant"];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("mensual");
  const [email, setEmail] = useState(defaultEmail);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setPending(true);
    setError(null);
    const result = await startSubscription(plan, cycle, email);
    if (result.error || !result.url) {
      setPending(false);
      setError(result.error ?? "No pudimos conectar con Mercado Pago.");
      return;
    }
    window.location.href = result.url;
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
        onClose={() => setOpen(false)}
        title={`Contratar el ${planName}`}
        description="Se paga con Mercado Pago, con débito automático. Cancelás cuando quieras desde acá."
      >
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

          <div>
            <Label htmlFor="mp-email" required>
              Email de tu cuenta de Mercado Pago
            </Label>
            <Input
              id="mp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tiene que ser el mismo con el que vas a pagar en Mercado Pago; si no coincide, Mercado
              Pago rechaza el pago.
            </p>
          </div>

          {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleContinue} disabled={pending || !email.trim()}>
              {pending ? "Conectando…" : "Ir a Mercado Pago"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
