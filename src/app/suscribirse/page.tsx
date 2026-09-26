import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckoutSummary } from "@/app/(auth)/registro/checkout-summary";
import { PayButton } from "@/app/suscribirse/pay-button";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, planLabels, type Plan } from "@/lib/subscription";
import { mercadoPagoConfigured } from "@/lib/mercadopago";
import { chargeAmount, syncReturnedPayment } from "@/lib/billing";
import { formatCurrency } from "@/lib/utils";

// Alta con un plan pago elegido en precios: después de crear el negocio se
// paga con Mercado Pago y recién ahí se entra a Pesito. Mercado Pago vuelve
// acá (?preapproval_id=…) y se aplica la suscripción sin esperar el aviso.

export const metadata: Metadata = {
  title: "Pagá tu plan",
  robots: { index: false, follow: false },
};

const PAID: Plan[] = ["esencial", "pro", "ia"];

export default async function SuscribirsePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; ciclo?: string; preapproval_id?: string }>;
}) {
  const { plan: planParam, ciclo, preapproval_id: preapprovalId } = await searchParams;
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) redirect("/pos");

  if (preapprovalId) {
    await syncReturnedPayment(organization.id, preapprovalId);
    const supabase = await createClient();
    const subscription = await getSubscription(supabase, organization.id);
    const paid = subscription.billing?.status === "active" && subscription.plan !== "gratis";

    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{paid ? "¡Listo! Tu plan está activo" : "Estamos confirmando tu pago"}</CardTitle>
            <CardDescription>
              {paid
                ? `Ya tenés el Plan ${planLabels[subscription.plan]}. Se renueva solo con Mercado Pago y lo manejás desde Configuración → Plan.`
                : "Mercado Pago todavía no nos confirmó el pago. Suele tardar unos segundos: cuando llegue, el plan se activa solo. Lo ves en Configuración → Plan."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/pos?bienvenida=1">
              <Button className="w-full">Entrar a Pesito</Button>
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const plan = PAID.find((p) => p === planParam);
  if (!plan) redirect("/pos");
  const cycle = ciclo === "anual" ? "anual" : "mensual";
  const amount = formatCurrency(chargeAmount(plan, cycle));

  return (
    <Shell>
      <div className="grid w-full max-w-4xl items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{`Pagá tu Plan ${planLabels[plan]}`}</CardTitle>
            <CardDescription>
              {`Tu cuenta ya está creada. Pagás ${amount} ${cycle === "anual" ? "por año" : "por mes"} con tarjeta o con tu cuenta de Mercado Pago, en una pestaña segura. Apenas se confirma, entrás a Pesito con el plan activo.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mercadoPagoConfigured() ? (
              <PayButton plan={plan} cycle={cycle} label={`Pagar ${amount}`} />
            ) : (
              <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                El cobro con Mercado Pago todavía no está disponible. Podés entrar y contratar el plan
                más tarde desde Configuración → Plan.
              </p>
            )}
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/pos?bienvenida=1" className="hover:underline">
                Prefiero empezar con el Plan Gratis
              </Link>
            </p>
          </CardContent>
        </Card>
        <CheckoutSummary plan={plan} annual={cycle === "anual"} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">{children}</div>
  );
}
