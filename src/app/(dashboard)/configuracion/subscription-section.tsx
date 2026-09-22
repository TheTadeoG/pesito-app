import Link from "next/link";
import { Bot, Check, Crown, Sparkles, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import type { Plan, SubscriptionInfo } from "@/lib/subscription";
import { FREE_PLAN_MONTHLY_SALES_LIMIT } from "@/lib/subscription";
import { paidPlanDefinitions, planDefinitions } from "@/lib/plan-features";

const planIcons: Record<Plan, typeof Sparkles> = {
  gratis: Sparkles,
  esencial: Zap,
  pro: Crown,
  ia: Bot,
};

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
  const CurrentIcon = planIcons[subscription.plan];
  const otherPlans = paidPlanDefinitions.filter((p) => p.plan !== subscription.plan);
  const limitReached =
    monthlySalesCount !== null && monthlySalesCount >= FREE_PLAN_MONTHLY_SALES_LIMIT;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripción</CardTitle>
        <CardDescription>Tu plan actual y qué incluye.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-accent to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CurrentIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-bold text-foreground">{current.name}</p>
              <p className="text-sm text-muted-foreground">
                {subscription.plan === "gratis" ? "Sin costo" : `${current.priceLabel} ${current.period}`}
              </p>
            </div>
          </div>
          {subscription.trialActive && subscription.proTrialEndsAt ? (
            <Badge tone="warning" className="w-fit text-sm">
              Prueba Pro hasta {formatDateTime(subscription.proTrialEndsAt)}
            </Badge>
          ) : subscription.plan === "gratis" ? (
            <Badge tone="default" className="w-fit">
              Sin funciones Pro
            </Badge>
          ) : null}
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {current.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>

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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherPlans.map((plan) => {
                const Icon = planIcons[plan.plan];
                const isRecommended = plan.badge !== null;
                return (
                  <div
                    key={plan.plan}
                    className={cn(
                      "relative flex flex-col gap-3.5 rounded-2xl border p-5",
                      isRecommended
                        ? "border-primary bg-card shadow-lg shadow-primary/10"
                        : "border-border bg-card"
                    )}
                  >
                    {plan.badge && (
                      <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                        {plan.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          isRecommended
                            ? "bg-primary/15 text-primary"
                            : "bg-accent text-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-base font-semibold text-foreground">{plan.name}</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">{plan.priceLabel}</span>
                      <span className="text-xs text-muted-foreground">{plan.period}</span>
                    </div>
                    <ul className="flex-1 space-y-1.5">
                      {plan.features
                        .filter((f) => !f.startsWith("Todas las funciones"))
                        .slice(0, 4)
                        .map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-1.5 text-xs text-muted-foreground"
                          >
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                            {feature}
                          </li>
                        ))}
                    </ul>
                    <a
                      href={`mailto:soporte@pesito.app?subject=${encodeURIComponent(
                        `Quiero pasarme al ${plan.name}`
                      )}`}
                    >
                      <Button
                        variant={isRecommended ? "primary" : "outline"}
                        size="sm"
                        className="w-full"
                      >
                        Pasate a {plan.name}
                      </Button>
                    </a>
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
