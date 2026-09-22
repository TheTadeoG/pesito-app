import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { SubscriptionInfo } from "@/lib/subscription";
import { FREE_PLAN_MONTHLY_SALES_LIMIT } from "@/lib/subscription";
import { paidPlanDefinitions, planDefinitions } from "@/lib/plan-features";

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
  const otherPlans = paidPlanDefinitions.filter((p) => p.plan !== subscription.plan);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripción</CardTitle>
        <CardDescription>Tu plan actual y qué incluye.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={subscription.plan === "gratis" ? "default" : "accent"} className="text-sm">
            {current.name}
          </Badge>
          {subscription.trialActive && subscription.proTrialEndsAt && (
            <Badge tone="warning">
              Prueba Pro hasta {formatDateTime(subscription.proTrialEndsAt)}
            </Badge>
          )}
          {subscription.plan === "gratis" && !subscription.trialActive && (
            <Badge tone="default">Sin funciones Pro</Badge>
          )}
        </div>

        <ul className="space-y-2">
          {current.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>

        {monthlySalesCount !== null && (
          <div
            className={
              monthlySalesCount >= FREE_PLAN_MONTHLY_SALES_LIMIT
                ? "rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
                : "rounded-xl border border-border px-4 py-3 text-sm text-foreground"
            }
          >
            <span className="font-semibold">
              {monthlySalesCount} / {FREE_PLAN_MONTHLY_SALES_LIMIT}
            </span>{" "}
            ventas este mes
            {monthlySalesCount >= FREE_PLAN_MONTHLY_SALES_LIMIT
              ? " — llegaste al límite del Plan Gratis. Pasate a un plan pago para seguir vendiendo."
              : "."}
          </div>
        )}

        {otherPlans.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm font-semibold">Pasarte a otro plan</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {otherPlans.map((plan) => (
                <div
                  key={plan.plan}
                  className="flex flex-col gap-2.5 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.priceLabel} {plan.period}
                    </p>
                  </div>
                  <ul className="flex-1 space-y-1">
                    {plan.features
                      .filter((f) => !f.startsWith("Todas las funciones"))
                      .slice(0, 4)
                      .map((feature) => (
                        <li key={feature} className="text-xs text-muted-foreground">
                          · {feature}
                        </li>
                      ))}
                  </ul>
                  <a
                    href={`mailto:soporte@pesito.app?subject=${encodeURIComponent(
                      `Quiero pasarme al ${plan.name}`
                    )}`}
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      Pasate a {plan.name}
                    </Button>
                  </a>
                </div>
              ))}
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
