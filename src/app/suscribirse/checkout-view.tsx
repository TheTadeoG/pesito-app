"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "@/components/marketing/wordmark";
import { Button } from "@/components/ui/button";
import { planIcons } from "@/lib/plan-visuals";
import { ANNUAL_DISCOUNT } from "@/lib/plan-features";
import { planLabels, type BillingCycle, type Plan } from "@/lib/subscription";
import type { PaymentMethod } from "@/lib/billing";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useMercadoPagoCheckout } from "@/app/(dashboard)/configuracion/use-mp-checkout";

// Colores del panel izquierdo según el plan (el mismo acento que en precios).
const themes: Record<Plan, { panel: string; ink: string; soft: string; icon: string; tick: string }> = {
  gratis: { panel: "", ink: "", soft: "", icon: "", tick: "" },
  esencial: {
    panel: "from-emerald-50 via-emerald-100/60 to-teal-50 dark:from-emerald-950/50 dark:via-background dark:to-background",
    ink: "text-emerald-950 dark:text-emerald-50",
    soft: "text-emerald-900/70 dark:text-emerald-100/70",
    icon: "bg-primary text-primary-foreground shadow-primary/30",
    tick: "bg-emerald-500/20",
  },
  pro: {
    panel: "from-amber-50 via-amber-100/60 to-orange-50 dark:from-amber-950/40 dark:via-background dark:to-background",
    ink: "text-amber-950 dark:text-amber-50",
    soft: "text-amber-900/70 dark:text-amber-100/70",
    icon: "bg-amber-500 text-amber-950 shadow-amber-500/30",
    tick: "bg-amber-500/20",
  },
  ia: {
    panel: "from-violet-50 via-violet-100/60 to-fuchsia-50 dark:from-violet-950/50 dark:via-background dark:to-background",
    ink: "text-violet-950 dark:text-violet-50",
    soft: "text-violet-900/70 dark:text-violet-100/70",
    icon: "bg-violet-500 text-white shadow-violet-500/30",
    tick: "bg-violet-500/20",
  },
};

const previousPlan: Partial<Record<Plan, string>> = { esencial: "Gratis", pro: "Esencial", ia: "Pro" };

export interface CheckoutViewProps {
  plan: Plan;
  initialCycle: BillingCycle;
  initialMethod: PaymentMethod;
  /** Último paso del alta (cuenta → negocio → pago). */
  fromSignup: boolean;
  features: string[];
  /** Monto de cada cobro: mensual, o el total del año. */
  prices: Record<BillingCycle, number>;
  /** Próximo cobro (débito) o hasta cuándo queda pago (pago único). */
  dates: Record<BillingCycle, Record<PaymentMethod, string>>;
  current: { planName: string; autoDebit: boolean; samePlan: boolean } | null;
  paymentsEnabled: boolean;
}

export function CheckoutView(props: CheckoutViewProps) {
  const { plan, fromSignup, features, prices, dates, current, paymentsEnabled } = props;
  const [cycle, setCycle] = useState<BillingCycle>(props.initialCycle);
  const [method, setMethod] = useState<PaymentMethod>(props.initialMethod);
  const { status, error, checkoutUrl, activePlan, periodEnd, start, check } = useMercadoPagoCheckout();

  const theme = themes[plan];
  const Icon = planIcons[plan];
  const planName = `Plan ${planLabels[plan]}`;
  const amount = prices[cycle];
  const monthly = prices.mensual;
  const annualMonthly = Math.round(monthly * (1 - ANNUAL_DISCOUNT));
  const exitHref = fromSignup ? "/pos?bienvenida=1" : "/configuracion?tab=plan";
  const busy = status !== "idle";

  // Pago confirmado: se muestra el aviso y se sigue solo. Carga completa
  // (no router.push): las pantallas guardadas en caché tienen el plan viejo.
  useEffect(() => {
    if (status !== "active") return;
    const id = window.setTimeout(() => window.location.assign(exitHref), 4000);
    return () => window.clearTimeout(id);
  }, [status, exitHref]);

  return (
    <div className="grid min-h-screen bg-card lg:grid-cols-2">
      {/* Panel del plan */}
      <section
        className={cn(
          "flex flex-col gap-8 bg-gradient-to-br px-5 py-6 sm:px-10 lg:justify-between lg:py-10",
          theme.panel
        )}
      >
        <div className={cn("flex items-center gap-3 text-sm", theme.soft)}>
          {fromSignup ? (
            <Wordmark className="text-lg" />
          ) : (
            <Link href="/configuracion?tab=plan" className="flex items-center gap-2 hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Volver a planes
            </Link>
          )}
        </div>

        <div className="max-w-md">
          <span
            className={cn("flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg", theme.icon)}
          >
            <Icon className="h-6 w-6" />
          </span>
          <p className={cn("mt-5 text-sm font-medium", theme.soft)}>
            {current?.samePlan ? "Renovar el" : "Suscribirte al"}
          </p>
          <h1 className={cn("text-3xl font-bold tracking-tight sm:text-4xl", theme.ink)}>{planName}</h1>
          <p className="mt-3 flex items-baseline gap-2">
            <span className={cn("text-4xl font-bold sm:text-5xl", theme.ink)}>
              {formatCurrency(cycle === "anual" ? annualMonthly : monthly)}
            </span>
            <span className={theme.soft}>por mes</span>
          </p>
          <p className={cn("mt-1 text-sm", theme.soft)}>
            {cycle === "anual"
              ? `${formatCurrency(prices.anual)} al año. Ahorrás ${formatCurrency(monthly * 12 - prices.anual)}.`
              : `O ${formatCurrency(annualMonthly)} por mes pagando anual (ahorrás ${formatCurrency(monthly * 12 - prices.anual)}).`}
          </p>

          <p className={cn("mt-8 text-xs font-semibold uppercase tracking-wider", theme.soft)}>
            {`Todo lo del Plan ${previousPlan[plan] ?? "Gratis"}, más:`}
          </p>
          <ul className="mt-3 space-y-3">
            {features.map((f) => (
              <li key={f} className={cn("flex gap-3", theme.ink)}>
                <span
                  className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", theme.tick)}
                >
                  <Check className="h-3 w-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className={cn("hidden items-center gap-2 text-xs lg:flex", theme.soft)}>
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Sin permanencia: lo cancelás cuando quieras desde Configuración → Plan.
        </p>
      </section>

      {/* Pago */}
      <section className="flex justify-center px-5 py-8 sm:px-10 lg:items-center lg:py-10">
        <div className="w-full max-w-md space-y-6">
          {fromSignup && <Steps />}

          {status === "active" ? (
            <Confirmed
              planName={`Plan ${planLabels[activePlan ?? plan]}`}
              periodEnd={periodEnd}
              method={method}
              href={exitHref}
              label={fromSignup ? "Entrar a Pesito" : "Volver a Pesito"}
            />
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Elegí cómo pagar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pagás con Mercado Pago, en una pestaña segura.
                </p>
              </div>

              <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm" role="radiogroup" aria-label="Período">
                {(["mensual", "anual"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={cycle === c}
                    disabled={busy}
                    onClick={() => setCycle(c)}
                    className={cn(
                      "rounded-lg py-2 text-center transition-colors",
                      cycle === c ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c === "mensual" ? "Mensual" : "Anual"}
                    {c === "anual" && <span className="ml-1 text-success">{`−${Math.round(ANNUAL_DISCOUNT * 100)}%`}</span>}
                  </button>
                ))}
              </div>

              <div className="space-y-3" role="radiogroup" aria-label="Forma de pago">
                <MethodOption
                  selected={method === "debito"}
                  disabled={busy}
                  onSelect={() => setMethod("debito")}
                  icon={RefreshCw}
                  title="Débito automático"
                  badge="Recomendado"
                  text={`Se renueva solo ${cycle === "anual" ? "cada año" : "cada mes"} con tu tarjeta o cuenta de Mercado Pago.`}
                />
                <MethodOption
                  selected={method === "unico"}
                  disabled={busy}
                  onSelect={() => setMethod("unico")}
                  icon={Wallet}
                  title="Pago único"
                  text={`${cycle === "anual" ? "Un año" : "Un mes"} con tarjeta, dinero en Mercado Pago o efectivo. No se renueva solo: te avisamos en Pesito antes de que venza.`}
                />
              </div>

              {current && (
                <p className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
                  {current.samePlan
                    ? current.autoDebit
                      ? `Ya tenés el Plan ${current.planName} con débito automático.${method === "unico" ? " Si pagás un pago único, el débito automático se da de baja." : " Si pagás de nuevo, el débito anterior se da de baja."}`
                      : `Hoy tenés el Plan ${current.planName}.${method === "unico" ? " El pago se suma al tiempo que ya tenés pago." : ""}`
                    : `Hoy tenés el Plan ${current.planName}. Al pagar pasás al ${planName}${current.autoDebit ? " y el débito anterior se da de baja" : ""}.`}
                </p>
              )}

              <dl className="space-y-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Hoy pagás</dt>
                  <dd className="text-lg font-bold text-foreground">{formatCurrency(amount)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{method === "debito" ? "Próximo cobro" : "Pago hasta el"}</dt>
                  <dd className="text-foreground">{dates[cycle][method]}</dd>
                </div>
              </dl>

              {status === "waiting" || status === "pending" ? (
                <Waiting pending={status === "pending"} checkoutUrl={checkoutUrl} onCheck={check} />
              ) : paymentsEnabled ? (
                <button
                  type="button"
                  onClick={() => start(plan, cycle, method)}
                  disabled={status === "opening"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {status === "opening" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Abriendo el pago…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      {method === "debito"
                        ? `Suscribirme por ${formatCurrency(amount)}${cycle === "anual" ? "/año" : "/mes"}`
                        : `Pagar ${formatCurrency(amount)}`}
                    </>
                  )}
                </button>
              ) : (
                <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  El pago con Mercado Pago todavía no está disponible. Escribinos a soporte@pesito.app y
                  te lo activamos.
                </p>
              )}

              {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Pago seguro procesado por Mercado Pago · Comprobante por email
              </p>

              {fromSignup && (
                <p className="text-center text-sm text-muted-foreground">
                  ¿Todavía no?{" "}
                  <Link href="/pos?bienvenida=1" className="font-medium text-primary hover:underline">
                    Empezá con el Plan Gratis
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Steps() {
  const steps = ["Tu cuenta", "Tu negocio", "Pago"];
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              i < 2 ? "bg-primary text-primary-foreground" : "border-2 border-foreground text-foreground"
            )}
          >
            {i < 2 ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={i === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 hidden h-px w-6 bg-border sm:block" />}
        </li>
      ))}
    </ol>
  );
}

function MethodOption({
  selected,
  disabled,
  onSelect,
  icon: I,
  title,
  badge,
  text,
}: {
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  badge?: string;
  text: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        <I className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
          {title}
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
      </span>
      <span
        className={cn(
          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-border"
        )}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

function Waiting({
  pending,
  checkoutUrl,
  onCheck,
}: {
  pending: boolean;
  checkoutUrl: string | null;
  onCheck: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 font-medium text-foreground">
        {pending ? <Clock className="h-4 w-4 text-warning" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Pago pendiente" : "Esperando la confirmación del pago…"}
      </p>
      <p className="text-sm text-muted-foreground">
        {pending
          ? "Cuando pagues en el local (Rapipago, Pago Fácil…) y Mercado Pago lo acredite, el plan se activa solo. Podés cerrar esta pantalla."
          : "Terminá el pago en la otra pestaña. Cuando se confirme, esta pantalla sigue sola."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCheck}>
          Ya pagué
        </Button>
        {checkoutUrl && !pending && (
          <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="ghost" size="sm">
              Volver a abrir el pago
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function Confirmed({
  planName,
  periodEnd,
  method,
  href,
  label,
}: {
  planName: string;
  periodEnd: string | null;
  method: PaymentMethod;
  href: string;
  label: string;
}) {
  return (
    <div className="space-y-5 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
      <div>
        <h2 className="text-2xl font-bold text-foreground">{`¡Listo! Tu ${planName} está activo`}</h2>
        {periodEnd && (
          <p className="mt-2 text-sm text-muted-foreground">
            {method === "debito"
              ? `Próximo cobro automático: ${formatDate(periodEnd)}.`
              : `Queda pago hasta el ${formatDate(periodEnd)}. Te avisamos antes de que venza.`}
          </p>
        )}
      </div>
      <a href={href} className="block">
        <Button className="w-full">{label}</Button>
      </a>
      <p className="text-xs text-muted-foreground">Te llevamos en unos segundos…</p>
    </div>
  );
}
