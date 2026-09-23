"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { paidPlanDefinitions } from "@/lib/plan-features";

// A propósito, un solo acento (el plan recomendado) en vez de un color por
// plan: acá el visitante todavía no sabe qué es "Pro" o "IA", así que 3
// colores distintos no comunican nada y sólo compiten por atención. El
// sistema de colores por plan (dorado/violeta) se usa dentro de la app
// (Configuración), donde el usuario ya conoce esos planes y el color sí
// funciona como señal — ver lib/plan-visuals.tsx.
const ANNUAL_DISCOUNT = 0.2;

const plans = paidPlanDefinitions.map((def) => ({
  name: def.name,
  price: def.price,
  badge: def.badge,
  features: def.features,
  cta: `Activar ${def.name}`,
  highlighted: def.plan === "pro",
}));

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="precios" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Precios simples, sin letra chica
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Elegí el plan que se ajuste a tu negocio. Probá 14 días gratis, sin tarjeta.
        </p>
      </div>

      <div className="mx-auto mt-8 flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Mensual
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Anual
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              annual ? "bg-white/20" : "bg-success-bg text-success"
            )}
          >
            -20%
          </span>
        </button>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const monthlyPrice = plan.price;
          const annualMonthlyPrice = Math.round(plan.price * (1 - ANNUAL_DISCOUNT));
          const displayedPrice = annual ? annualMonthlyPrice : monthlyPrice;

          return (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-card bg-card p-7",
                plan.highlighted
                  ? "border-2 border-primary shadow-2xl shadow-primary/20 lg:-translate-y-3"
                  : "border border-border"
              )}
            >
              {plan.badge &&
                (plan.highlighted ? (
                  <span className="absolute -top-3.5 left-1/2 w-fit -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30">
                    {plan.badge}
                  </span>
                ) : (
                  <span className="mb-3 w-fit rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success">
                    {plan.badge}
                  </span>
                ))}
              <h3
                className={cn(
                  "text-lg font-semibold text-foreground",
                  plan.highlighted && "mt-1"
                )}
              >
                {plan.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-foreground">
                  {formatCurrency(displayedPrice)}
                </span>
                {annual && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatCurrency(monthlyPrice)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {annual ? "por mes · facturado anual, IVA incl." : "por mes · IVA incl."}
              </p>
              {annual && (
                <p className="mt-0.5 text-xs font-medium text-success">
                  Ahorrás {formatCurrency(monthlyPrice * 12 - annualMonthlyPrice * 12)} al año
                </p>
              )}

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
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        ¿Cadenas o franquicias con varias sucursales? Escribinos por WhatsApp.
      </p>
    </section>
  );
}
