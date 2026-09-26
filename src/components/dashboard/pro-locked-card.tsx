import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { planLabels, type Plan } from "@/lib/subscription";

// Funciones que el plan del negocio no incluye: se muestran igual, con el
// plan que las desbloquea y un link para contratarlo (pedido del usuario:
// siempre incentivar a pasar de plan, nunca esconder). El plan mínimo sale
// de featureMinPlan (lib/plan-access.ts).

/** Color de cada plan (el mismo de las tarjetas de planes y la barra lateral). */
export const planTone: Record<Plan, string> = {
  gratis: "bg-muted text-muted-foreground",
  esencial: "bg-primary/10 text-primary",
  pro: "bg-amber-500/15 text-amber-600",
  ia: "bg-violet-500/15 text-violet-500",
};

/** Link a la pantalla de pago del plan (a quien no es dueño/admin lo manda a Planes). */
export function upgradeHref(plan: Plan): string {
  return `/suscribirse?plan=${plan}`;
}

/** Silueta de fondo: muestra qué hay detrás del candado sin datos reales. */
export type LockedPreview = "bars" | "list" | "comparison";

const BAR_HEIGHTS = [35, 55, 42, 70, 50, 85, 62, 48, 75, 58, 90, 66];
// Filas de mentira que se ven borrosas (como la ganancia estimada bloqueada):
// se nota que hay datos, pero no se leen. No son datos del negocio.
const FAKE_ROWS = [
  ["Nombre de producto", "$ 48.500"],
  ["Otro producto", "$ 36.200"],
  ["Producto de ejemplo", "$ 29.900"],
  ["Uno más", "$ 18.750"],
  ["El último", "$ 9.400"],
];

/** Contenido borroso para las tarjetas chicas (compact). */
function BlurredContent({ kind }: { kind: LockedPreview }) {
  if (kind === "bars") {
    return (
      <div className="flex h-36 items-end gap-2 px-6 pb-4 blur-[3px]">
        {BAR_HEIGHTS.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-primary/60" style={{ height: `${h}%` }} />
        ))}
      </div>
    );
  }
  if (kind === "comparison") {
    return (
      <div className="grid grid-cols-2 gap-4 px-6 pb-4 blur-[4px]">
        {[
          ["Este período", "$ 000.000", "+12%"],
          ["Período anterior", "$ 000.000", "−3%"],
        ].map(([label, value, delta]) => (
          <div key={label} className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-xs font-semibold text-success">{delta}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="divide-y divide-border px-6 pb-2 blur-[4px]">
      {FAKE_ROWS.map(([name, value]) => (
        <div key={name} className="flex items-center justify-between py-2 text-sm">
          <span className="text-foreground">{name}</span>
          <span className="font-semibold text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}
const LIST_WIDTHS = [78, 64, 70, 52, 60];

function PreviewSkeleton({ kind }: { kind: LockedPreview }) {
  if (kind === "bars") {
    return (
      <div className="flex h-44 items-end gap-2 px-6 pb-6">
        {BAR_HEIGHTS.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-primary/25" style={{ height: `${h}%` }} />
        ))}
      </div>
    );
  }
  if (kind === "comparison") {
    return (
      <div className="grid grid-cols-2 gap-4 p-6">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-4">
            <div className="h-3 w-1/2 rounded-full bg-muted-foreground/20" />
            <div className="h-7 w-3/4 rounded-lg bg-muted-foreground/25" />
            <div className="h-3 w-1/3 rounded-full bg-success/30" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3 p-6">
      {LIST_WIDTHS.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 rounded-full bg-muted-foreground/20" style={{ width: `${w}%` }} />
          <div className="ml-auto h-3 w-16 shrink-0 rounded-full bg-muted-foreground/25" />
        </div>
      ))}
    </div>
  );
}

/**
 * Card que reemplaza a una función cuando el plan no la incluye. Con
 * `preview` se ve una silueta gris del reporte de fondo (barras, lista o
 * comparación) y el cartel encima: muestra lo que se está perdiendo.
 */
export function ProLockedCard({
  title,
  plan = "pro",
  description,
  preview,
  compact = false,
}: {
  title: string;
  plan?: Plan;
  description?: string;
  preview?: LockedPreview;
  /**
   * Varios bloqueados en la misma pantalla (Reportes): tarjeta chica con
   * título, plan y silueta, sin cartel ni botones (el aviso con el botón va
   * una sola vez arriba). Toda la tarjeta lleva a contratar el plan.
   */
  compact?: boolean;
}) {
  const planName = planLabels[plan];
  if (compact) {
    return (
      <Link href={upgradeHref(plan)} prefetch={false} className="group block">
        <Card className="overflow-hidden transition-colors group-hover:border-primary/40">
          <div className="flex items-center gap-2 px-6 pt-5">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="truncate font-semibold text-foreground">{title}</p>
            <PlanPill plan={plan} className="ml-auto" />
          </div>
          <div aria-hidden className="pointer-events-none mt-3 select-none">
            <BlurredContent kind={preview ?? "list"} />
          </div>
          <p className="px-6 pb-4 text-xs text-muted-foreground group-hover:text-primary">
            {description ?? `Disponible desde el Plan ${planName}.`}
          </p>
        </Card>
      </Link>
    );
  }
  const message = (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Lock className="h-5 w-5" />
      </span>
      <div>
        <div className="mb-1 flex items-center justify-center gap-2">
          <p className="font-semibold text-foreground">{title}</p>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", planTone[plan])}>
            {planName}
          </span>
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
    </div>
  );

  if (!preview) {
    return (
      <Card>
        <CardContent className="py-10">{message}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none select-none opacity-70 blur-[2px]">
        <div className="px-6 pt-5">
          <div className="h-4 w-48 rounded-full bg-muted-foreground/20" />
        </div>
        <PreviewSkeleton kind={preview} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-card/60 p-4 backdrop-blur-[1px]">
        <div className="rounded-2xl border border-border bg-card/95 px-5 py-5 shadow-lg">{message}</div>
      </div>
    </Card>
  );
}

/** Pastilla chica "🔒 Plan X" para botones u opciones bloqueadas. */
export function PlanPill({ plan, className }: { plan: Plan; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold",
        planTone[plan],
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
  cta,
}: {
  plan: Plan;
  children: React.ReactNode;
  className?: string;
  /** Texto del link (por defecto "Conocé el Plan X"). */
  cta?: string;
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
          {cta ?? `Conocé el Plan ${planLabels[plan]}`}
        </Link>
      </div>
    </div>
  );
}
