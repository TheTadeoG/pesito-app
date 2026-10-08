import Link from "next/link";
import { planIcons } from "@/lib/plan-visuals";
import { planLabels, type Plan } from "@/lib/subscription";
import { isOrgAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";

// Color del texto de cada plan (el mismo acento que en precios).
const planTagColors: Record<Plan, string> = {
  gratis: "text-muted-foreground",
  esencial: "text-primary",
  pro: "text-amber-600",
  ia: "text-violet-500",
};

/** Plan actual, discreto: ícono y nombre con el color del plan. */
export function PlanTag({ plan, trial }: { plan: Plan; trial: boolean }) {
  const Icon = planIcons[plan];
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold", planTagColors[plan])}>
      <Icon className="h-3 w-3" />
      {trial ? "Prueba Pro" : planLabels[plan]}
    </span>
  );
}

/**
 * "Dueño · Plan Pro": el rol y el plan de la cuenta. Quien administra el
 * negocio puede tocar el plan para ir a Planes. Lo usan el menú lateral (computadora)
 * y la barra de arriba (celular).
 */
export function PlanLine({
  roleLabel,
  plan,
  trial,
  role,
  className,
}: {
  roleLabel: string;
  plan: Plan;
  trial: boolean;
  role: string;
  className?: string;
}) {
  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      {/* Si no entra, se recorta el rol, no el plan. */}
      <span className="truncate">{roleLabel}</span>
      <span aria-hidden className="shrink-0">·</span>
      {isOrgAdmin(role) ? (
        <Link href="/planes" className="shrink-0 whitespace-nowrap hover:underline">
          <PlanTag plan={plan} trial={trial} />
        </Link>
      ) : (
        <span className="shrink-0 whitespace-nowrap">
          <PlanTag plan={plan} trial={trial} />
        </span>
      )}
    </p>
  );
}
