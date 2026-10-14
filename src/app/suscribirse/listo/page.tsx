import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels } from "@/lib/subscription";
import { syncReturnedPayment } from "@/lib/billing";
import { formatDate } from "@/lib/utils";
import { chargeAmount } from "@/lib/billing";
import { TrackEvent } from "@/components/track-event";
import { ListoView } from "./listo-view";
import { planDefinitions } from "@/lib/plan-features";

// A dónde vuelve Mercado Pago (en la misma pestaña) con
// ?preapproval_id= (débito automático) o ?payment_id=&status= (pago único).
// Se aplica lo pagado y la pantalla sigue sola a Pesito (listo-view.tsx).

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
  const renewal = periodEnd
    ? autoDebit
      ? `Se renueva solo el ${periodEnd} con débito automático.`
      : `Queda pago hasta el ${periodEnd}.`
    : "";

  // Compra confirmada: se avisa una sola vez por pago (sin datos personales).
  const transactionId = params.preapproval_id ?? params.payment_id ?? billing?.mpPreapprovalId ?? null;
  const purchaseValue = paid && subscription.plan !== "gratis" ? chargeAmount(subscription.plan, billing?.cycle ?? "mensual") : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {paid && transactionId && subscription.plan !== "gratis" && (
        <TrackEvent
          event="purchase"
          dedupeKey={`purchase-${transactionId}`}
          params={{
            transaction_id: transactionId,
            currency: "ARS",
            value: purchaseValue,
            items: [
              {
                item_id: subscription.plan,
                item_name: `Plan ${planLabels[subscription.plan]}`,
                item_variant: billing?.cycle ?? "mensual",
                price: purchaseValue,
                quantity: 1,
              },
            ],
          }}
        />
      )}
      <ListoView
        state={paid ? "paid" : pending ? "pending" : "confirming"}
        planName={`Plan ${planLabels[subscription.plan]}`}
        renewal={renewal}
        features={planDefinitions[subscription.plan].features.slice(1, 5)}
        href="/pos"
      />
    </div>
  );
}
