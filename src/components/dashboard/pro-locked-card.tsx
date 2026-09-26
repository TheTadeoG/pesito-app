import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { planLabels, type Plan } from "@/lib/subscription";

// Funciones que el plan del negocio no incluye: se muestran igual, con el
// plan que las desbloquea y un link para contratarlo (pedido del usuario:
// siempre incentivar a pasar de plan, nunca esconder). El plan mínimo sale
// de featureMinPlan (lib/plan-access.ts).

/** Link a la pantalla de pago del plan (a quien no es dueño/admin lo manda a Planes). */
export function upgradeHref(plan: Plan): string {
  return `/suscribirse?plan=${plan}`;
}

/** Card que reemplaza a una pantalla entera cuando el plan no la incluye. */
export function ProLockedCard({
  title,
  plan = "pro",
  description,
}: {
  title: string;
  plan?: Plan;
  description?: string;
}) {
  const planName = planLabels[plan];
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <div className="mb-1 flex items-center justify-center gap-2">
            <p className="font-semibold text-foreground">{title}</p>
            <Badge tone="accent">{planName}</Badge>
          </div>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description ?? `Disponible desde el Plan ${planName}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={upgradeHref(plan)}
            prefetch={false}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            {`Pasate al Plan ${planName}`}
          </Link>
          <Link
            href="/configuracion?tab=plan"
            prefetch={false}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver planes
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** Pastilla chica "🔒 Plan X" para botones u opciones bloqueadas. */
export function PlanPill({ plan, className }: { plan: Plan; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold text-amber-600",
        className
      )}
    >
      <Lock className="h-2.5 w-2.5" />
      {planLabels[plan]}
    </span>
  );
}

/** Aviso dentro de una pantalla: qué se desbloquea y con qué plan. */
export function PlanLockNote({
  plan,
  children,
  className,
}: {
  plan: Plan;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3.5 py-3 text-sm",
        className
      )}
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1 text-foreground">
        {children}{" "}
        <Link href={upgradeHref(plan)} prefetch={false} className="font-semibold text-primary hover:underline">
          {`Pasate al Plan ${planLabels[plan]}`}
        </Link>
      </div>
    </div>
  );
}
