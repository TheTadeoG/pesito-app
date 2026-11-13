"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { startSubscription } from "@/app/(dashboard)/configuracion/billing-actions";
import { formatCurrency } from "@/lib/utils";
import type { BillingCycle, Plan } from "@/lib/subscription";

// Baja de plan programada: hoy y desde la renovación lado a lado, los días que faltan y cómo deshacerla.
export function PlanChangeNotice({
  plan,
  cycle,
  pack,
  fromName,
  toName,
  fromTotal,
  toTotal,
  date,
  daysLeft,
  canManage,
}: {
  plan: Plan;
  cycle: BillingCycle;
  pack: number;
  fromName: string;
  toName: string;
  fromTotal: number;
  toTotal: number;
  date: string;
  daysLeft: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const per = cycle === "anual" ? "por año" : "por mes";

  async function undo() {
    setPending(true);
    setError(null);
    const res = await startSubscription(plan, cycle, "debito", pack);
    if (res.scheduled === "restore") {
      showSuccess("Cancelaste el cambio de plan", `Seguís con el Plan ${fromName} y tu débito no cambia.`);
      router.refresh();
      return;
    }
    setPending(false);
    setError(res.error ?? "No pudimos deshacer el cambio. Probá de nuevo.");
  }

  return (
    <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 shrink-0" />
          {`Cambio programado para el ${date}`}
        </p>
        <span className="rounded-full border border-sky-500/40 px-2.5 py-0.5 text-xs font-semibold text-foreground">
          {daysLeft === 1 ? "Falta 1 día" : `Faltan ${daysLeft} días`}
        </span>
      </div>
      <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hoy</p>
          <p className="text-lg font-bold text-foreground">{`Plan ${fromName}`}</p>
          <p className="text-xs text-muted-foreground">{`${formatCurrency(fromTotal)} ${per}`}</p>
        </div>
        <span className="flex items-center justify-center text-muted-foreground" aria-hidden="true">
          <ArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" />
        </span>
        <div className="rounded-lg border border-sky-500/40 bg-card px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{`Desde el ${date}`}</p>
          <p className="text-lg font-bold text-foreground">{`Plan ${toName}`}</p>
          <p className="text-xs text-muted-foreground">{`${formatCurrency(toTotal)} ${per}`}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{`Hasta entonces tenés todo el Plan ${fromName}, que ya está pago.`}</p>
        {canManage && (
          <Button type="button" size="sm" variant="outline" onClick={undo} disabled={pending}>
            {pending ? "Deshaciendo…" : "Deshacer el cambio"}
          </Button>
        )}
      </div>
      {error && <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
