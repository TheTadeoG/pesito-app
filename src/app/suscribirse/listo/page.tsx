import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels } from "@/lib/subscription";
import { syncReturnedPayment } from "@/lib/billing";
import { formatDate } from "@/lib/utils";

// A dónde vuelve Mercado Pago (en la pestaña del pago) con
// ?preapproval_id= (débito automático) o ?payment_id=&status= (pago único).
// Se aplica lo pagado; la pestaña original de Pesito se actualiza sola.

export const metadata: Metadata = {
  title: "Pago del plan",
  robots: { index: false, follow: false },
};

export default async function PagoListoPage({
  searchParams,
}: {
  searchParams: Promise<{ preapproval_id?: string; payment_id?: string; status?: string; collection_status?: string }>;
}) {
  const params = await searchParams;
  const { organization } = await requireOrgContext();
  await syncReturnedPayment(organization.id, {
    preapprovalId: params.preapproval_id,
    paymentId: params.payment_id,
  });
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  const status = params.status ?? params.collection_status;
  const paid = subscription.plan !== "gratis" && Boolean(subscription.billing?.status) && subscription.billing?.status !== "past_due";
  const pending = !paid && (status === "pending" || status === "in_process");

  // Débito automático: próxima renovación. Pago único: hasta cuándo quedó pago.
  const billing = subscription.billing;
  const periodEnd = billing?.currentPeriodEnd ? formatDate(billing.currentPeriodEnd) : null;
  const autoDebit = billing?.status === "active" && Boolean(billing.mpPreapprovalId);
  const periodText = periodEnd
    ? autoDebit
      ? `Se renueva solo el ${periodEnd} con débito automático. `
      : `Pago hasta el ${periodEnd}. `
    : "";

  const Icon = paid ? CheckCircle2 : pending ? Clock : Loader2;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <Icon className={paid ? "mx-auto h-14 w-14 text-success" : pending ? "mx-auto h-12 w-12 text-warning" : "mx-auto h-12 w-12 animate-spin text-muted-foreground"} />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {paid
              ? `¡Listo! Tu Plan ${planLabels[subscription.plan]} está activo`
              : pending
                ? "Tu pago está pendiente"
                : "Estamos confirmando tu pago"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {paid
              ? `${periodText}Ya podés cerrar esta pestaña y volver a Pesito.`
              : pending
                ? "Cuando pagues y Mercado Pago lo acredite, el plan se activa solo."
                : "Suele tardar unos segundos. Cuando se confirme, el plan se activa solo en Pesito."}
          </p>
        </div>
        <Link href="/pos" className="block">
          <Button className="w-full">Ir a Pesito</Button>
        </Link>
      </div>
    </div>
  );
}
