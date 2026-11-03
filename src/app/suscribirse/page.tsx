import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels, planOrder, type BillingCycle, type Plan } from "@/lib/subscription";
import { mercadoPagoConfigured } from "@/lib/mercadopago";
import { chargeAmount, firstChargeAmount, isPromoEligible, packChange, planChange, upgradeChange, type PaymentMethod } from "@/lib/billing";
import { normalizePlanParam } from "@/lib/plan-ids";
import { INVOICE_PACKS, isValidPack } from "@/lib/invoice-packs";
import { planLimits } from "@/lib/plan-access";
import { getPlanOwnFeatures } from "@/lib/plan-features";
import { CheckoutView } from "@/app/suscribirse/checkout-view";

// Pantalla de pago de un plan. Se llega desde Configuración → Plan
// ("Contratar") y, al crear la cuenta con un plan elegido en precios, como
// último paso del alta (?desde=alta). El pago se hace en Mercado Pago en
// la misma pestaña; al volver a /suscribirse/listo sigue sola a Pesito.

export const metadata: Metadata = {
  title: "Pagá tu plan",
  robots: { index: false, follow: false },
};

const PAID: Plan[] = ["basico", "pro", "max"];

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
  searchParams: Promise<{ plan?: string; ciclo?: string; metodo?: string; desde?: string; paquete?: string }>;
}) {
  const { plan: planParam, ciclo, metodo, desde, paquete } = await searchParams;
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) redirect("/planes");

  const plan = PAID.find((p) => p === normalizePlanParam(planParam));
  if (!plan) redirect("/planes");
  let cycle: BillingCycle = ciclo === "anual" ? "anual" : "mensual";
  const method: PaymentMethod = metodo === "unico" ? "unico" : "debito";
  const wantedPack = Number(paquete);

  const supabase = await createClient();
  const [subscription, promoEligible] = await Promise.all([
    getSubscription(supabase, organization.id),
    isPromoEligible(organization.id),
  ]);
  const billing = subscription.billing;
  // Mismo plan con débito automático activo: cambiar el paquete no crea otra suscripción (se usa el ciclo que ya paga).
  const activeCycle = billing?.status === "active" && billing.cycle ? billing.cycle : null;
  const isUpgrade = subscription.plan !== "gratis" && planOrder.indexOf(plan) > planOrder.indexOf(subscription.plan);
  const sameBilling = (subscription.plan === plan || isUpgrade) && activeCycle ? activeCycle : null;
  if (sameBilling) cycle = sameBilling;
  const downgradeCycle = billing?.status === "active" && billing.cycle ? billing.cycle : null;
  const planSwitch = downgradeCycle ? planChange(subscription, plan, downgradeCycle) : null;
  const changes = sameBilling
    ? Object.fromEntries(
        [0, ...INVOICE_PACKS.map((p) => p.size)].flatMap((size) => {
          const c = isUpgrade ? upgradeChange(subscription, plan, cycle, size) : packChange(subscription, plan, cycle, size);
          return c
            ? [
                [
                  size,
                  {
                    kind: c.kind,
                    today: c.today,
                    next: c.next,
                    planPart: chargeAmount(isUpgrade ? plan : subscription.nextPlan ?? plan, cycle, 0),
                    packFull: chargeAmount(plan, cycle, size) - chargeAmount(plan, cycle, 0),
                    credit: chargeAmount(subscription.plan, cycle, subscription.invoicePack) - chargeAmount(subscription.plan, cycle, 0),
                    currentTotal: chargeAmount(subscription.nextPlan ?? subscription.plan, cycle, subscription.nextInvoicePack ?? subscription.invoicePack),
                    fullNow: chargeAmount(plan, cycle, size),
                    paidNow: chargeAmount(subscription.plan, cycle, subscription.invoicePack),
                  },
                ],
              ]
            : [];
        })
      )
    : null;

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
      totals={Object.fromEntries(
        [0, ...INVOICE_PACKS.map((p) => p.size)].map((pack) => [
          pack,
          {
            prices: { mensual: chargeAmount(plan, "mensual", pack), anual: chargeAmount(plan, "anual", pack) },
            promoPrice: promoEligible ? firstChargeAmount(plan, "mensual", true, pack) : null,
          },
        ])
      )}
      planSwitch={planSwitch ? { kind: planSwitch.kind, next: planSwitch.next, planPart: chargeAmount(planSwitch.kind === "restore" ? subscription.plan : plan, downgradeCycle!, 0), pack: subscription.nextInvoicePack ?? subscription.invoicePack, date: longDate(new Date(planSwitch.nextDate)), fromName: planLabels[subscription.plan], limits: planLimits[plan] } : null}
      currentPack={subscription.invoicePack}
      upgradeFrom={isUpgrade ? planLabels[subscription.plan] : null}
      changes={changes && Object.keys(changes).length > 0 ? changes : null}
      changeDate={billing?.currentPeriodEnd ? longDate(new Date(billing.currentPeriodEnd)) : ""}
      initialPack={Number.isInteger(wantedPack) && paquete && isValidPack(wantedPack) ? wantedPack : subscription.plan !== "gratis" ? subscription.nextInvoicePack ?? subscription.invoicePack : 0}
      dates={dates}
      current={current}
      paymentsEnabled={mercadoPagoConfigured()}
    />
  );
}
