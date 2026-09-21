import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Gratis",
    price: "$0",
    period: "para siempre",
    description: "Para arrancar y probar Pesito en tu kiosco.",
    features: [
      "1 usuario",
      "Hasta 100 productos",
      "Punto de venta y caja diaria",
      "Reportes básicos",
    ],
    cta: "Empezar gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9.900",
    period: "por mes",
    description: "Para el kiosco o almacén que ya no para de crecer.",
    features: [
      "Usuarios ilimitados",
      "Productos ilimitados",
      "Clientes y cuenta corriente (fiado)",
      "Recomendaciones con IA",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
    cta: "Probar Pro",
    highlighted: true,
  },
];

export function Pricing() {
  return (
    <section id="precios" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Precios simples, sin letra chica
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Empezá gratis. Pasate a Pro cuando tu kiosco lo necesite.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
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
            {plan.highlighted && (
              <span className="mb-3 w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Más elegido
              </span>
            )}
            <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>

            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link href="/registro" className="mt-7">
              <Button
                variant={plan.highlighted ? "primary" : "outline"}
                className="w-full"
              >
                {plan.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
