import Link from "next/link";
import { Check, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Plan Esencial",
    price: "$20.000",
    period: "por mes · IVA incl.",
    badge: null,
    features: [
      "Ventas rápidas con lector de código de barras o teclado",
      "Productos por unidad, peso y variantes",
      "Stock: sumar, restar y ajustar a cantidad exacta",
      "Caja diaria con arqueo y diferencias",
      "Clientes y cuentas corrientes (fiado)",
      "Reportes de ventas e ingresos",
      "Hasta 2 usuarios",
      "Facturación de ARCA (costo adicional)",
    ],
    cta: "Activar Plan Esencial",
    highlighted: false,
  },
  {
    name: "Plan Pro",
    price: "$35.000",
    period: "por mes · IVA incl.",
    badge: "Más elegido",
    features: [
      "Todas las funciones del Plan Esencial +",
      "Reportes avanzados: períodos, gráficos y widgets",
      "Múltiples cajas y usuarios simultáneos",
      "Historial completo de caja (aperturas, cierres, diferencias)",
      "Hasta 10 usuarios",
      "Facturación de ARCA (costo adicional)",
      "Soporte prioritario",
    ],
    cta: "Activar Plan Pro",
    highlighted: true,
  },
  {
    name: "Plan IA",
    price: "$40.000",
    period: "por mes · IVA incl.",
    badge: "Nuevo",
    features: [
      "Todas las funciones del Plan Pro +",
      "Recomendaciones de reposición con IA",
      "Detección de productos de baja rotación",
      "Precios sugeridos automáticamente",
      "Facturación de ARCA (costo adicional)",
      "Soporte prioritario 24/7",
    ],
    cta: "Activar Plan IA",
    highlighted: false,
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
          Elegí el plan que se ajuste a tu kiosco o almacén. Probá 7 días gratis, sin tarjeta.
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
              <Button
                variant={plan.highlighted ? "primary" : "outline"}
                className="w-full"
              >
                {plan.cta}
              </Button>
            </Link>
            <p className="mt-2 text-center text-xs text-muted-foreground">Probar gratis 7 días</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-3xl rounded-card border border-dashed border-border bg-muted/40 p-5 text-center">
        <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Receipt className="h-4 w-4" />
        </span>
        <p className="mt-2.5 text-sm font-semibold text-foreground">
          ¿Necesitás emitir Factura A, B o C con CAE?
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Sumá facturación electrónica de ARCA a cualquier plan por un costo aparte, que
          calculamos según cuánto factures por mes.
        </p>
        <Link href="/soporte" className="mt-3 inline-block">
          <Button variant="outline" size="sm">
            Consultar precio de facturación
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
