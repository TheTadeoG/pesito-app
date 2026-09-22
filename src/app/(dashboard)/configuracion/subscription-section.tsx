import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import type { SubscriptionInfo } from "@/lib/subscription";
import { planOrder } from "@/lib/subscription";
import { planDefinitions } from "@/lib/plan-features";

export function SubscriptionSection({ subscription }: { subscription: SubscriptionInfo }) {
  const current = planDefinitions[subscription.plan];
  // Lo próximo a lo que valdría la pena subirse: el siguiente plan en el
  // orden (Gratis -> Esencial -> Pro -> IA). Al plan IA no le mostramos
  // "próximo plan" porque ya es el más alto.
  const currentIndex = planOrder.indexOf(subscription.plan);
  const nextPlan = currentIndex < planOrder.length - 1 ? planDefinitions[planOrder[currentIndex + 1]] : null;

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

        {nextPlan && (
          <div
            className={cn(
              "space-y-3 rounded-xl border px-4 py-4",
              "border-primary/30 bg-accent"
            )}
          >
            <div className="flex items-center gap-2 text-accent-foreground">
              <Sparkles className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">Qué te suma {nextPlan.name}</p>
            </div>
            <ul className="space-y-1.5">
              {nextPlan.features
                .filter((f) => !f.startsWith("Todas las funciones"))
                .map((feature) => (
                  <li key={feature} className="text-sm text-accent-foreground">
                    · {feature}
                  </li>
                ))}
            </ul>
            <p className="text-xs text-accent-foreground/80">
              {nextPlan.priceLabel} {nextPlan.period}
            </p>
            <a href="mailto:soporte@pesito.app?subject=Quiero pasarme al Plan Pro">
              <Button variant="primary" size="sm">
                Pasate a {nextPlan.name}
              </Button>
            </a>
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
