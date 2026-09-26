"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BillingInfo } from "@/lib/subscription";
import { cancelSubscription, getUpdatePaymentUrl } from "@/app/(dashboard)/configuracion/billing-actions";

// Estado del débito automático del plan (Mercado Pago).
export function BillingStatus({
  billing,
  amount,
  planName,
  canManage,
}: {
  billing: BillingInfo;
  amount: number;
  planName: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!confirm(`¿Cancelar el débito automático del ${planName}? Seguís con el plan hasta el fin del período pago.`)) return;
    setPending(true);
    setError(null);
    const result = await cancelSubscription();
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleUpdatePayment() {
    setPending(true);
    setError(null);
    const result = await getUpdatePaymentUrl();
    if (result.error || !result.url) {
      setPending(false);
      setError(result.error ?? "No pudimos abrir Mercado Pago.");
      return;
    }
    window.location.href = result.url;
  }

  const periodEnd = billing.currentPeriodEnd ? formatDate(billing.currentPeriodEnd) : null;
  const cycleText = billing.cycle === "anual" ? "por año" : "por mes";
  // Pago único: no hay suscripción; el plan vence al final del período.
  const oneTime = billing.status === "cancelled" && !billing.mpPreapprovalId;
  const renewHref = `/suscribirse?plan=${billing.paidPlan}&ciclo=${billing.cycle ?? "mensual"}`;

  if (oneTime) {
    return (
      <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {`Pago único con Mercado Pago · ${formatCurrency(amount)} ${cycleText}`}
        </p>
        <p className="text-muted-foreground">
          {periodEnd
            ? `Pago hasta el ${periodEnd}. No se renueva solo: después pasás al Plan Gratis si no lo renovás.`
            : "No se renueva solo."}
        </p>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Link href={`${renewHref}&metodo=unico`}>
              <Button size="sm">Renovar</Button>
            </Link>
            <Link href={renewHref}>
              <Button size="sm" variant="outline">
                Pasar a débito automático
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        {`Pago con Mercado Pago · ${formatCurrency(amount)} ${cycleText}`}
      </p>

      {billing.status === "active" && (
        <p className="text-muted-foreground">
          {periodEnd ? `Al día. Próximo débito: ${periodEnd}.` : "Al día."}
        </p>
      )}

      {billing.status === "past_due" && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {`No pudimos cobrar el último pago. Mercado Pago lo va a reintentar; si no se paga${
              billing.graceUntil ? ` antes del ${formatDate(billing.graceUntil)}` : ""
            }, el negocio pasa al Plan Gratis (no perdés ningún dato).`}
          </p>
        </div>
      )}

      {billing.status === "cancelled" && (
        <p className="text-muted-foreground">
          {periodEnd
            ? `Cancelaste el débito automático. Seguís con el ${planName} hasta el ${periodEnd}; después pasás al Plan Gratis.`
            : "Cancelaste el débito automático."}
        </p>
      )}

      {canManage && billing.status === "cancelled" && (
        <Link href={renewHref}>
          <Button size="sm">Volver a activar el débito automático</Button>
        </Link>
      )}

      {canManage && billing.status !== "cancelled" && (
        <div className="flex flex-wrap gap-2">
          {billing.status === "past_due" && (
            <Button size="sm" onClick={handleUpdatePayment} disabled={pending}>
              Actualizar medio de pago
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={pending}>
            Cancelar débito automático
          </Button>
        </div>
      )}

      {error && <p className="rounded-lg bg-danger-bg px-3 py-2 text-danger">{error}</p>}
    </div>
  );
}
