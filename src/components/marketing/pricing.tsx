import Link from "next/link";
import { Check, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { paidPlanDefinitions } from "@/lib/plan-features";

// A propósito, un solo acento (el plan recomendado) en vez de un color por
// plan: acá el visitante todavía no sabe qué es "Pro" o "IA", así que 3
// colores distintos no comunican nada y sólo compiten por atención. El
// sistema de colores por plan (dorado/violeta) se usa dentro de la app
// (Configuración), donde el usuario ya conoce esos planes y el color sí
// funciona como señal — ver lib/plan-visuals.tsx.
const plans = paidPlanDefinitions.map((def) => ({
  name: def.name,
  price: def.priceLabel,
  period: def.period,
  badge: def.badge,
  features: def.features,
  cta: `Activar ${def.name}`,
  highlighted: def.plan === "pro",
}));

const invoiceTiers = [
  { label: "500 fact/mes", price: "$10.000/mes" },
  { label: "1.000 fact/mes", price: "$20.000/mes" },
  { label: "2.000 fact/mes", price: "$40.000/mes" },
  { label: "4.000 fact/mes", price: "$80.000/mes" },
];

export function Pricing() {
  return (
    <section id="precios" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Precios simples, sin letra chica
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Elegí el plan que se ajuste a tu kiosco o almacén. Probá 14 días gratis, sin tarjeta.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "flex flex-col rounded-card border p-7",
              plan.highlighted
                ? "border-primary bg-card shadow-xl shadow-primary/10"
                : "border-border bg-card"
            )}
          >
            {plan.badge && (
              <span
                className={cn(
                  "mb-3 w-fit rounded-full px-3 py-1 text-xs font-semibold",
                  plan.highlighted
                    ? "bg-primary/10 text-primary"
                    : "bg-success-bg text-success"
                )}
              >
                {plan.badge}
              </span>
            )}
            <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground">{plan.price}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.period}</p>

            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link href="/registro" className="mt-7">
              <Button variant={plan.highlighted ? "primary" : "outline"} className="w-full">
                {plan.cta}
              </Button>
            </Link>
            <p className="mt-2 text-center text-xs text-muted-foreground">Probá gratis 14 días</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-4 rounded-card border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Facturación electrónica</p>
            <p className="text-xs text-muted-foreground">Facturas A, B y C con CAE automático.</p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {invoiceTiers.map((tier) => (
            <div
              key={tier.label}
              className="rounded-xl border border-border px-3 py-2 text-center"
            >
              <p className="text-xs font-semibold text-foreground">{tier.label}</p>
              <p className="text-xs text-muted-foreground">{tier.price}</p>
            </div>
          ))}
        </div>

        <Link href="/registro" className="shrink-0">
          <Button variant="primary" className="w-full sm:w-auto">
            Activar con facturación
          </Button>
        </Link>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Cadenas o franquicias con varias sucursales?{" "}
        <Link href="/soporte" className="font-medium text-primary hover:underline">
          Hablemos
        </Link>
      </p>
    </section>
  );
}
