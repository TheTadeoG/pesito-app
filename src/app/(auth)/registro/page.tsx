import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignupForm } from "@/app/(auth)/registro/signup-form";
import { CheckoutSummary } from "@/app/(auth)/registro/checkout-summary";
import { planDefinitions } from "@/lib/plan-features";
import type { Plan } from "@/lib/subscription";
import { siteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Creá tu cuenta gratis",
  description:
    "Registrate gratis en Pesito y empezá a manejar el punto de venta, el stock y la caja de tu kiosco o almacén en minutos.",
  alternates: { canonical: "/registro", languages: { "es-AR": `${siteUrl}/registro` } },
};

const CHECKOUT_PLANS = ["esencial", "pro", "ia"] as const;

function resolvePlan(value: string | undefined): Plan | null {
  return CHECKOUT_PLANS.includes(value as (typeof CHECKOUT_PLANS)[number])
    ? (value as Plan)
    : null;
}

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; anual?: string }>;
}) {
  const { plan: planParam, anual } = await searchParams;
  const plan = resolvePlan(planParam);

  if (plan) {
    const planName = planDefinitions[plan].name;
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Creá tu cuenta</CardTitle>
            <CardDescription>Último paso antes de arrancar tu prueba del {planName}.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm submitLabel={`Crear cuenta y empezar mi prueba`} />
          </CardContent>
        </Card>
        <CheckoutSummary plan={plan} annual={anual === "1"} />
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Creá tu cuenta gratis</CardTitle>
        <CardDescription>Empezá a usar Pesito en tu kiosco en minutos.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
