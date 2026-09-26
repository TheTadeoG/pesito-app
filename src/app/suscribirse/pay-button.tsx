"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planLabels, type BillingCycle, type Plan } from "@/lib/subscription";
import { useMercadoPagoCheckout } from "@/app/(dashboard)/configuracion/use-mp-checkout";

export function PayButton({ plan, cycle, label }: { plan: Plan; cycle: BillingCycle; label: string }) {
  const router = useRouter();
  const { status, error, checkoutUrl, activePlan, start, check } = useMercadoPagoCheckout("alta");

  // Pago confirmado: se muestra el aviso y se entra solo a Pesito.
  useEffect(() => {
    if (status !== "active") return;
    const id = window.setTimeout(() => router.push("/pos?bienvenida=1"), 3000);
    return () => window.clearTimeout(id);
  }, [status, router]);

  if (status === "active") {
    return (
      <div className="space-y-3 rounded-xl bg-success-bg p-4 text-success">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-5 w-5" />
          {`¡Pago confirmado! Ya tenés el Plan ${planLabels[activePlan ?? plan]}.`}
        </p>
        <p className="text-sm">Te llevamos a Pesito en unos segundos…</p>
        <Button type="button" className="w-full" onClick={() => router.push("/pos?bienvenida=1")}>
          Entrar a Pesito
        </Button>
      </div>
    );
  }

  if (status === "waiting") {
    return (
      <div className="space-y-3 rounded-xl border border-border p-4">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Esperando la confirmación del pago…
        </p>
        <p className="text-sm text-muted-foreground">
          Terminá el pago en la otra pestaña. Cuando se confirme, esta pantalla sigue sola.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={check}>
            Ya pagué
          </Button>
          {checkoutUrl && (
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="ghost" size="sm">
                Volver a abrir el pago
              </Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="button" className="w-full" onClick={() => start(plan, cycle)} disabled={status === "opening"}>
        {status === "opening" ? "Abriendo el pago…" : label}
      </Button>
    </div>
  );
}
