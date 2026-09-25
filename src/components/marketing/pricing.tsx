"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clock, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { ANNUAL_DISCOUNT, paidPlanDefinitions, planDefinitions } from "@/lib/plan-features";

// A propósito, un solo acento (el plan recomendado) en vez de un color por
// plan: acá el visitante todavía no sabe qué es "Pro" o "IA", así que 3
// colores distintos no comunican nada y sólo compiten por atención. El
// sistema de colores por plan (dorado/violeta) se usa dentro de la app
// (Configuración), donde el usuario ya conoce esos planes y el color sí
// funciona como señal — ver lib/plan-visuals.tsx.

const plans = paidPlanDefinitions.map((def) => {
  // "Todas las funciones del Plan X +" pasa a ser el encabezado de la lista:
  // en cada plan pago se ve sólo lo que suma sobre el anterior.
  const [first, ...rest] = def.features;
  const includesPrevious = first?.startsWith("Todas las funciones");
  return {
    plan: def.plan,
    name: def.name,
    price: def.price,
    badge: def.badge,
    previous: includesPrevious ? first.replace("Todas las funciones del ", "").replace(" +", "") : null,
    features: includesPrevious ? rest : def.features,
    soon: def.soon ?? [],
    cta: `Activar ${def.name}`,
    highlighted: def.plan === "pro",
  };
});

const freePlan = planDefinitions.gratis;

export function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="precios" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Empezá gratis. Pagá recién cuando crezcas
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          El Plan Gratis no vence y no pide tarjeta. Cuando tu negocio necesite más ventas,
          usuarios o sucursales, elegís el plan que te sirva.
        </p>
      </div>

      <div className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-success/30 bg-success-bg px-5 py-4 text-sm text-foreground">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <p>
          <span className="font-semibold">Al crear tu cuenta tenés 14 días del Plan Pro gratis.</span>{" "}
          Probás todo sin pagar nada; cuando termina seguís en el Plan Gratis, o elegís un plan si
          te sirve más.
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

      <div className="mx-auto mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative flex flex-col rounded-card border border-border bg-card p-7">
          <h3 className="text-lg font-semibold text-foreground">{freePlan.name}</h3>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-foreground">$0</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">para siempre · sin tarjeta</p>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Incluye
          </p>
          <ul className="mt-3 flex-1 space-y-3">
            {freePlan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {feature}
              </li>
            ))}
          </ul>
          <Link href="/registro" className="mt-7">
            <Button variant="outline" className="w-full">
              Empezar gratis
            </Button>
          </Link>
        </div>

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
              {plan.badge && plan.highlighted && (
                <span className="absolute -top-3.5 left-1/2 w-fit -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30">
                  {plan.badge}
                </span>
              )}
              <div className="flex items-center gap-2">
                <h3
                  className={cn(
                    "text-lg font-semibold text-foreground",
                    plan.highlighted && "mt-1"
                  )}
                >
                  {plan.name}
                </h3>
                {plan.badge && !plan.highlighted && (
                  <span className="w-fit shrink-0 rounded-full bg-success-bg px-2.5 py-0.5 text-[10px] font-semibold text-success">
                    {plan.badge}
                  </span>
                )}
              </div>
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
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatCurrency(annualMonthlyPrice * 12)} facturados una vez al año
                </p>
              )}
              {annual && (
                <p className="mt-0.5 text-xs font-medium text-success">
                  Ahorrás {formatCurrency(monthlyPrice * 12 - annualMonthlyPrice * 12)} al año
                </p>
              )}

              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {plan.previous ? `Todo lo del ${plan.previous}, y además` : "Incluye"}
              </p>
              <ul className="mt-3 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {feature}
                  </li>
                ))}
                {plan.soon.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {feature}{" "}
                      <span className="whitespace-nowrap rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                        Pronto
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <Link href={`/registro?plan=${plan.plan}&anual=${annual ? "1" : "0"}`} className="mt-7">
                <Button variant={plan.highlighted ? "primary" : "outline"} className="w-full">
                  {plan.cta}
                </Button>
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        ¿Cadenas o franquicias con muchas sucursales? Escribinos por WhatsApp.
      </p>
    </section>
  );
}
