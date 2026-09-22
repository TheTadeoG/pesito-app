import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import type { SubscriptionInfo } from "@/lib/subscription";
import { FREE_PLAN_MONTHLY_SALES_LIMIT } from "@/lib/subscription";
import { paidPlanDefinitions, planDefinitions, getPlanOwnFeatures } from "@/lib/plan-features";
import { planAccents, planIcons, PlanTierBadge } from "@/lib/plan-visuals";

export function SubscriptionSection({
  subscription,
  monthlySalesCount,
}: {
  subscription: SubscriptionInfo;
  // Sólo se calcula (en el server) cuando hace falta mostrarlo: plan
  // gratis y sin prueba Pro activa.
  monthlySalesCount: number | null;
}) {
  const current = planDefinitions[subscription.plan];
  const currentAccent = planAccents[subscription.plan];
  const CurrentIcon = planIcons[subscription.plan];
  const otherPlans = paidPlanDefinitions.filter((p) => p.plan !== subscription.plan);
  const limitReached =
    monthlySalesCount !== null && monthlySalesCount >= FREE_PLAN_MONTHLY_SALES_LIMIT;

  // Durante la prueba, lo que realmente cambia es que se destraban las
  // funciones exclusivas de Pro (no todo lo de Esencial, que hoy no tiene
  // nada gateado en código aparte del plan en sí) — se enumeran aparte,
  // marcadas como "Pro" y con la fecha en que se apagan.
  const trialFeatures = subscription.trialActive ? getPlanOwnFeatures("pro") : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripción</CardTitle>
        <CardDescription>Tu plan actual y qué incluye.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-accent to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                currentAccent.iconBg
              )}
            >
              <CurrentIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-bold text-foreground">{current.name}</p>
              <p className="text-sm text-muted-foreground">
                {subscription.plan === "gratis" ? "Sin costo" : `${current.priceLabel} ${current.period}`}
              </p>
            </div>
          </div>
          {subscription.plan === "gratis" && !subscription.trialActive && (
            <Badge tone="default" className="w-fit">
              Sin funciones Pro
            </Badge>
          )}
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {current.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>

        {subscription.trialActive && subscription.proTrialEndsAt && (
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground">
              Además, por tu prueba, hasta el{" "}
              <span className="font-medium text-foreground">
                {formatDateTime(subscription.proTrialEndsAt)}
              </span>
              :
            </p>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {trialFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    {feature}
                    <PlanTierBadge plan="pro" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {monthlySalesCount !== null && (
          <div
            className={cn(
              "space-y-2.5 rounded-xl border p-4",
              limitReached ? "border-danger/30 bg-danger-bg" : "border-border"
            )}
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <span
                className={cn(
                  "font-semibold",
                  limitReached ? "text-danger" : "text-foreground"
                )}
              >
                {monthlySalesCount} / {FREE_PLAN_MONTHLY_SALES_LIMIT} ventas este mes
              </span>
              {limitReached && (
                <span className="shrink-0 text-xs font-medium text-danger">Límite alcanzado</span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  limitReached ? "bg-danger" : "bg-primary"
                )}
                style={{
                  width: `${Math.min(100, (monthlySalesCount / FREE_PLAN_MONTHLY_SALES_LIMIT) * 100)}%`,
                }}
              />
            </div>
            {limitReached && (
              <p className="text-xs text-danger">
                Pasate a un plan pago para seguir vendiendo sin límite.
              </p>
            )}
          </div>
        )}

        {otherPlans.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm font-semibold">Pasarte a otro plan</p>
            </div>
            {/* Una sola columna a propósito: en las 3 de antes el precio, el
                período y hasta el botón se cortaban en dos líneas por el
                ancho angosto de esta página. Acá cada plan tiene todo el
                ancho para mostrar el detalle completo, sin recortar nada. */}
            <div className="space-y-4">
              {otherPlans.map((plan) => {
                const accent = planAccents[plan.plan];
                const Icon = planIcons[plan.plan];
                return (
                  <div
                    key={plan.plan}
                    className={cn("rounded-xl border bg-card p-5", accent.border, accent.shadow)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                            accent.iconBg
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{plan.name}</p>
                            {plan.badge && (
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                  accent.badgeBg,
                                  accent.badgeText
                                )}
                              >
                                {plan.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="text-base font-bold text-foreground">
                              {plan.priceLabel}
                            </span>{" "}
                            {plan.period}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`mailto:soporte@pesito.app?subject=${encodeURIComponent(
                          `Quiero pasarme al ${plan.name}`
                        )}`}
                      >
                        <Button variant={accent.buttonVariant} size="sm">
                          Pasate a {plan.name}
                        </Button>
                      </a>
                    </div>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ¿Tenés dudas sobre tu plan?{" "}
          <Link href="/soporte" className="font-medium text-primary hover:underline">
            Escribinos
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
