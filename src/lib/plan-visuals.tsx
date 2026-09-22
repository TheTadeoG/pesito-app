import { Bot, Crown, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/subscription";

// Ícono y acento de color por plan, compartido entre la landing
// (marketing/pricing.tsx) y Configuración > Suscripción, para que los
// planes más altos se sientan distintos entre sí (más "premium") en vez
// de ser todos la misma tarjeta verde con distinto precio.
export const planIcons: Record<Plan, LucideIcon> = {
  gratis: Sparkles,
  esencial: Zap,
  pro: Crown,
  ia: Bot,
};

export interface PlanAccent {
  iconBg: string;
  border: string;
  shadow: string;
  badgeBg: string;
  badgeText: string;
  buttonVariant: "outline" | "gold" | "violet";
}

export const planAccents: Record<Plan, PlanAccent> = {
  gratis: {
    iconBg: "bg-accent text-accent-foreground",
    border: "border-border",
    shadow: "",
    badgeBg: "bg-muted",
    badgeText: "text-muted-foreground",
    buttonVariant: "outline",
  },
  esencial: {
    iconBg: "bg-accent text-accent-foreground",
    border: "border-border",
    shadow: "",
    badgeBg: "bg-muted",
    badgeText: "text-muted-foreground",
    buttonVariant: "outline",
  },
  // Pro: dorado — el plan "premium" del medio. Un tono para fondo claro y
  // otro para oscuro (esta app no define un color "warning"-like propio
  // para esto, y un solo tono fijo se pierde en alguno de los dos temas).
  pro: {
    iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-500/40",
    shadow: "shadow-lg shadow-amber-500/10",
    badgeBg: "bg-amber-500",
    badgeText: "text-amber-950",
    buttonVariant: "gold",
  },
  // IA: violeta — se distingue como el tope de gama, con onda "tecnológico".
  ia: {
    iconBg: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
    border: "border-violet-300 dark:border-violet-500/40",
    shadow: "shadow-lg shadow-violet-500/10",
    badgeBg: "bg-violet-500",
    badgeText: "text-white",
    buttonVariant: "violet",
  },
};

/**
 * Etiqueta chica ("PRO"/"IA") para marcar una función puntual como
 * exclusiva de ese plan — p. ej. las que se destraban temporalmente con
 * la prueba. Reutiliza el mismo tono suave que el ícono del plan (ya
 * pensado para leerse bien en claro y oscuro) en vez de un color fijo,
 * para que la etiqueta siempre combine con la identidad de ese plan.
 */
export function PlanTierBadge({ plan }: { plan: Plan }) {
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide",
        planAccents[plan].iconBg
      )}
    >
      {plan === "ia" ? "IA" : plan}
    </span>
  );
}
