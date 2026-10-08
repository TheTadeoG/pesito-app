"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { navSections, isNavItemActive, type NavItem, type NavSection } from "@/lib/nav";
import { planIcons } from "@/lib/plan-visuals";
import { planLabels, type Plan } from "@/lib/subscription";
import { isOrgAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/marketing/wordmark";
import { NavSearch } from "@/components/dashboard/nav-search";
import { VenderCard } from "@/components/dashboard/vender-card";
import { BranchSwitcher, type BranchSwitcherProps } from "@/components/dashboard/branch-switcher";
import type { PlanFeature } from "@/lib/plan-access";

interface SidebarProps {
  orgName: string;
  memberName: string;
  roleLabel: string;
  /** Plan que vale hoy (con la prueba Pro, "pro" y trial). */
  plan: Plan;
  trial: boolean;
  role: string;
  cashRegister: {
    openedAt: string;
    openingAmount: number;
    cashTotal: number | null;
    branchName?: string | null;
  } | null;
  branch: BranchSwitcherProps | null;
  /** Funciones que el plan no incluye, con el plan que las trae ("Pro"). */
  lockedFeatures: Partial<Record<PlanFeature, string>>;
  /** Numerito rojo por ruta (ej. proveedores con deuda vencida). 0 no se muestra. */
  alerts?: Record<string, number>;
  /** Hora de cierre del negocio, para avisar en el bloque de la caja. */
  closeTime?: string | null;
}

export function Sidebar({
  orgName,
  roleLabel,
  plan,
  trial,
  role,
  cashRegister,
  branch,
  lockedFeatures,
  alerts = {},
  closeTime = null,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const canSeeAdminItems = isOrgAdmin(role);

  function renderItem(item: NavItem) {
    const active = isNavItemActive(item, pathname, tabParam);
        const badge = item.badge ?? (item.feature ? lockedFeatures[item.feature] : undefined);
    return (
      <Link
        key={item.href}
        href={item.href}
        // Sin esto, Next.js prefetchea los ~14 links del menú
        // apenas se monta el sidebar (todos entran en el
        // viewport de una) — cada uno dispara el layout del
        // dashboard (auth + suscripción + caja) de nuevo, aun
        // sin que nadie haya clickeado nada. En cambio, se
        // precarga sólo el que el mouse está tocando (abajo):
        // sigue sintiéndose instantáneo al clickear, sin pagar
        // por los otros 13 que nadie pidió.
        prefetch={false}
        onMouseEnter={() => router.prefetch(item.href)}
        className={cn(
          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-active-bg text-sidebar-active-foreground"
            : "text-sidebar-foreground hover:bg-muted"
        )}
      >
        <span className="flex items-center gap-2.5">
          <item.icon className="h-4 w-4" />
          {item.label}
        </span>
        {badge && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {badge}
          </span>
        )}
        {(alerts[item.href] ?? 0) > 0 && (
          <span
            className="min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-[10px] font-bold text-white"
            title="Con deuda vencida"
            aria-label={`${alerts[item.href]} con deuda vencida`}
          >
            {alerts[item.href]}
          </span>
        )}
      </Link>
    );
  }

  const visible = (section: NavSection) =>
    section.items.filter(
      (item) =>
        item.href !== "/pos" &&
        (item.href !== "/caja" || !cashRegister) &&
        (!item.adminOnly || canSeeAdminItems)
    );

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex items-start gap-2 border-b border-border px-5 py-3">
        <Wordmark className="mt-0.5 shrink-0 text-xl" />
        <div className="min-w-0 space-y-0.5 border-l border-border pl-2.5">
          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground" title={orgName}>
            {orgName}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {roleLabel}
            <span aria-hidden>·</span>
            {canSeeAdminItems ? (
              <Link href="/planes" className="hover:underline">
                <PlanTag plan={plan} trial={trial} />
              </Link>
            ) : (
              <PlanTag plan={plan} trial={trial} />
            )}
          </p>
          {branch && <BranchSwitcher {...branch} />}
        </div>
      </div>

      <div className="px-3 pb-2 pt-3">
        <VenderCard cashRegister={cashRegister} closeTime={closeTime} />
      </div>

      <div className="px-3 pb-1">
        <NavSearch canSeeAdminItems={canSeeAdminItems} hasCashRegister={Boolean(cashRegister)} />
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {navSections
          .filter((section) => !section.footer)
          .map((section) => {
            const items = visible(section);
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </p>
                <div className="mt-1 space-y-0.5">{items.map(renderItem)}</div>
              </div>
            );
          })}
      </nav>

      {navSections
        .filter((section) => section.footer)
        .map((section) => (
          <div key={section.title} className="space-y-0.5 border-t border-border px-3 py-1.5">
            {visible(section).map(renderItem)}
          </div>
        ))}
    </aside>
  );
}

// Color del texto de cada plan (el mismo acento que en precios).
const planTagColors: Record<Plan, string> = {
  gratis: "text-muted-foreground",
  esencial: "text-primary",
  pro: "text-amber-600",
  ia: "text-violet-500",
};

/** Plan actual, discreto: ícono y nombre con el color del plan. */
function PlanTag({ plan, trial }: { plan: Plan; trial: boolean }) {
  const Icon = planIcons[plan];
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold", planTagColors[plan])}>
      <Icon className="h-3 w-3" />
      {trial ? "Prueba Pro" : planLabels[plan]}
    </span>
  );
}
