import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels, type BillingCycle, type Plan } from "@/lib/subscription";
import { mercadoPagoConfigured } from "@/lib/mercadopago";
import { chargeAmount, type PaymentMethod } from "@/lib/billing";
import { getPlanOwnFeatures } from "@/lib/plan-features";
import { CheckoutView } from "@/app/suscribirse/checkout-view";

// Pantalla de pago de un plan. Se llega desde Configuración → Plan
// ("Contratar") y, al crear la cuenta con un plan elegido en precios, como
// último paso del alta (?desde=alta). El pago se hace en Mercado Pago en
// otra pestaña; esta pantalla espera la confirmación y sigue sola.

export const metadata: Metadata = {
  title: "Pagá tu plan",
  robots: { index: false, follow: false },
};

const PAID: Plan[] = ["esencial", "pro", "ia"];

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function longDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

export default async function SuscribirsePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; ciclo?: string; metodo?: string; desde?: string }>;
}) {
  const { plan: planParam, ciclo, metodo, desde } = await searchParams;
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) redirect("/pos");

  const plan = PAID.find((p) => p === planParam);
  if (!plan) redirect("/configuracion?tab=plan");
  const cycle: BillingCycle = ciclo === "anual" ? "anual" : "mensual";
  const method: PaymentMethod = metodo === "unico" ? "unico" : "debito";

  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  const billing = subscription.billing;

  // Fechas que se muestran en el resumen (calculadas acá para que el
  // servidor y el navegador muestren lo mismo). El pago único del mismo plan
  // se suma a lo que ya estaba pago.
  const now = new Date();
  const paidUntil =
    subscription.plan === plan && billing?.currentPeriodEnd && new Date(billing.currentPeriodEnd) > now
      ? new Date(billing.currentPeriodEnd)
      : now;
  const dates = {
    mensual: { debito: longDate(addMonths(now, 1)), unico: longDate(addMonths(paidUntil, 1)) },
    anual: { debito: longDate(addMonths(now, 12)), unico: longDate(addMonths(paidUntil, 12)) },
  };

  const current =
    subscription.plan !== "gratis" && billing
      ? {
          planName: planLabels[subscription.plan],
          autoDebit: billing.status === "active" || billing.status === "past_due",
          samePlan: subscription.plan === plan,
        }
      : null;

  return (
    <CheckoutView
      plan={plan}
      initialCycle={cycle}
      initialMethod={method}
      fromSignup={desde === "alta"}
      features={getPlanOwnFeatures(plan)
        .filter((f) => !f.includes("(pronto)"))
        .slice(0, 5)}
      prices={{ mensual: chargeAmount(plan, "mensual"), anual: chargeAmount(plan, "anual") }}
      dates={dates}
      current={current}
      paymentsEnabled={mercadoPagoConfigured()}
    />
  );
}
