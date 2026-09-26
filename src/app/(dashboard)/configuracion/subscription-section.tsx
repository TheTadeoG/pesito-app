import Link from "next/link";
import { Check, CheckCircle2, Clock, History, Sparkles, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import type { PlanHistoryEntry, SubscriptionInfo } from "@/lib/subscription";
import { FREE_PLAN_MONTHLY_SALES_LIMIT, planLabels, planOrder } from "@/lib/subscription";
import { planDefinitions, getPlanOwnFeatures } from "@/lib/plan-features";
import { planAccents, planIcons, PlanTierBadge } from "@/lib/plan-visuals";
import { chargeAmount } from "@/lib/billing";
import { SubscribeButton } from "@/app/(dashboard)/configuracion/subscribe-button";
import { BillingStatus } from "@/app/(dashboard)/configuracion/billing-status";

export function SubscriptionSection({
  subscription,
  monthlySalesCount,
  planHistory,
  canManage,
  paymentsEnabled,
}: {
  subscription: SubscriptionInfo;
  /** Dueño o administrador: contrata, cambia o cancela el plan. */
  canManage: boolean;
  /** Mercado Pago configurado (MP_ACCESS_TOKEN). */
  paymentsEnabled: boolean;
  // Sólo se calcula (en el server) cuando hace falta mostrarlo: plan
  // gratis y sin prueba Pro activa.
  monthlySalesCount: number | null;
  planHistory: PlanHistoryEntry[];
}) {
  const current = planDefinitions[subscription.plan];
  const billing = subscription.billing;
  const currentAccent = planAccents[subscription.plan];
  const CurrentIcon = planIcons[subscription.plan];
  const limitReached =
    monthlySalesCount !== null && monthlySalesCount >= FREE_PLAN_MONTHLY_SALES_LIMIT;

  // Durante la prueba, lo que realmente cambia es que se destraban las
  // funciones exclusivas de Pro (no todo lo de Esencial, que hoy no tiene
  // nada gateado en código aparte del plan en sí) — se enumeran aparte,
  // marcadas como "Pro" y con la fecha en que se apagan.
  const trialFeatures = subscription.trialActive ? getPlanOwnFeatures("pro") : [];

  const trialDaysLeft =
    subscription.trialActive && subscription.proTrialEndsAt
      ? Math.max(
          0,
          // eslint-disable-next-line react-hooks/purity -- Server Component: se calcula fresco en cada request.
          Math.ceil((new Date(subscription.proTrialEndsAt).getTime() - Date.now()) / 86_400_000)
        )
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripción</CardTitle>
        <CardDescription>
          Tu plan actual, cómo se compara con los demás y tu historial de cambios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={cn("rounded-2xl border p-5 sm:p-6", currentAccent.border, currentAccent.shadow)}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                  currentAccent.iconBg
                )}
              >
                <CurrentIcon className="h-7 w-7" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tu plan actual
                </p>
                <p className="text-2xl font-bold text-foreground">{current.name}</p>
                <p className="text-sm text-muted-foreground">
                  {subscription.plan === "gratis"
                    ? "Sin costo"
                    : `${current.priceLabel} ${current.period}`}
                </p>
              </div>
            </div>
            {subscription.plan === "gratis" && !subscription.trialActive && (
              <Badge tone="default" className="w-fit">
                Sin funciones Pro
              </Badge>
            )}
          </div>

          {billing && billing.paidPlan !== "gratis" && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <BillingStatus
                billing={billing}
                amount={chargeAmount(billing.paidPlan, billing.cycle ?? "mensual")}
                planName={planDefinitions[billing.paidPlan].name}
                canManage={canManage}
              />
            </div>
          )}

          {trialDaysLeft !== null && subscription.proTrialEndsAt && (
            <div className="mt-4 grid gap-2.5 border-t border-border/60 pt-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vencimiento de tu prueba Pro
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatDateTime(subscription.proTrialEndsAt)}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-xl px-4 py-3",
                  trialDaysLeft <= 1 ? "bg-danger-bg" : "bg-muted/50"
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Días restantes
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    trialDaysLeft <= 1 ? "text-danger" : "text-foreground"
                  )}
                >
                  {trialDaysLeft} día{trialDaysLeft !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}

          <ul className="mt-4 grid gap-2.5 border-t border-border/60 pt-4 sm:grid-cols-2">
            {current.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {feature}
              </li>
            ))}
            {current.soon?.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                {feature} (pronto)
              </li>
            ))}
          </ul>

          {subscription.trialActive && (
            <div className="mt-4 space-y-2.5 border-t border-border/60 pt-4">
              <p className="text-xs text-muted-foreground">Además, por tu prueba:</p>
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
        </div>

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

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm font-semibold">Comparar planes</p>
          </div>
          <div className="grid gap-x-4 gap-y-7 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            {planOrder.map((plan) => {
              const def = planDefinitions[plan];
              const accent = planAccents[plan];
              const Icon = planIcons[plan];
              const isCurrent = plan === subscription.plan;
              // El plan gratis no tiene flujo de "pasarte" por mail — es el
              // punto de partida, no algo que se contrate.
              const canSwitch = !isCurrent && plan !== "gratis";
              // Recomendado: el "Más elegido", sólo si es una mejora sobre el plan actual.
              const isRecommended =
                def.badge === "Más elegido" &&
                !isCurrent &&
                planOrder.indexOf(plan) > planOrder.indexOf(subscription.plan);
              return (
                <div
                  key={plan}
                  className={cn(
                    "relative flex flex-col gap-3 rounded-xl border bg-card p-4 pt-5",
                    isCurrent
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : isRecommended
                        ? "border-amber-400 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400 lg:-translate-y-1"
                        : "border-border"
                  )}
                >
                  {(isCurrent || isRecommended) && (
                    <span
                      className={cn(
                        "absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow-sm",
                        isCurrent ? "bg-primary text-primary-foreground" : "bg-amber-500 text-amber-950"
                      )}
                    >
                      {isCurrent ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5 fill-current" />}
                      {isCurrent ? "Tu plan actual" : "Recomendado"}
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        accent.iconBg
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {!isCurrent && !isRecommended && (
                      def.badge && (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            accent.badgeBg,
                            accent.badgeText
                          )}
                        >
                          {def.badge}
                        </span>
                      )
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{def.name}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="text-base font-bold text-foreground">
                        {def.priceLabel}
                      </span>{" "}
                      {def.plan !== "gratis" && def.period}
                    </p>
                  </div>
                  <ul className="flex-1 space-y-1.5">
                    {def.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-1.5 text-xs text-foreground"
                      >
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                        {feature}
                      </li>
                    ))}
                    {def.soon?.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-1.5 text-xs text-muted-foreground"
                      >
                        <Clock className="mt-0.5 h-3 w-3 shrink-0" />
                        {feature} (pronto)
                      </li>
                    ))}
                  </ul>
                  {isCurrent && (
                    <p className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-1.5 text-sm font-semibold text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      Es tu plan actual
                    </p>
                  )}
                  {canSwitch && canManage && paymentsEnabled && (
                    <SubscribeButton
                      plan={plan}
                      variant={accent.buttonVariant}
                      label={
                        subscription.plan === "gratis" ? `Contratar ${def.name}` : `Cambiar al ${def.name}`
                      }
                    />
                  )}
                  {canSwitch && canManage && !paymentsEnabled && (
                    <a
                      href={`mailto:soporte@pesito.app?subject=${encodeURIComponent(
                        `Quiero pasarme al ${def.name}`
                      )}`}
                    >
                      <Button variant={accent.buttonVariant} size="sm" className="w-full">
                        Pasate a {def.name}
                      </Button>
                    </a>
                  )}
                  {canSwitch && !canManage && (
                    <p className="text-center text-xs text-muted-foreground">
                      Lo contrata el dueño o un administrador.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {planHistory.length > 0 && (
          <div className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center gap-2 text-foreground">
              <History className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm font-semibold">Historial de cambios de plan</p>
            </div>
            <ul className="space-y-2">
              {planHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-2.5 text-sm"
                >
                  <span className="text-foreground">
                    Pasaste de <span className="font-medium">{planLabels[entry.fromPlan]}</span>{" "}
                    a <span className="font-medium">{planLabels[entry.toPlan]}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
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
