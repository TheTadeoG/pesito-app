"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { navSections, isNavItemActive } from "@/lib/nav";
import { isOrgAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/marketing/wordmark";
import { VenderCard } from "@/components/dashboard/vender-card";
import { BranchSwitcher, type BranchSwitcherProps } from "@/components/dashboard/branch-switcher";
import type { PlanFeature } from "@/lib/plan-access";

interface SidebarProps {
  orgName: string;
  memberName: string;
  roleLabel: string;
  /** "Plan Pro", "Prueba Pro"… para que siempre se vea qué plan se tiene. */
  planLabel: string;
  role: string;
  cashRegister: {
    openedAt: string;
    openingAmount: number;
    cashTotal: number | null;
  } | null;
  branch: BranchSwitcherProps | null;
  /** Funciones que el plan no incluye, con el plan que las trae ("Pro"). */
  lockedFeatures: Partial<Record<PlanFeature, string>>;
}

export function Sidebar({
  orgName,
  memberName,
  roleLabel,
  planLabel,
  role,
  cashRegister,
  branch,
  lockedFeatures,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const canSeeAdminItems = isOrgAdmin(role);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex items-start gap-2 border-b border-border px-5 py-4">
        <Wordmark className="mt-0.5 shrink-0 text-xl" />
        <div className="min-w-0 space-y-0.5 border-l border-border pl-2.5">
          <p className="truncate text-sm font-semibold text-foreground">{orgName}</p>
          {memberName && (
            <p className="truncate text-xs text-muted-foreground">{memberName}</p>
          )}
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
          {canSeeAdminItems ? (
            <Link
              href="/configuracion?tab=plan"
              className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/15"
            >
              {planLabel}
            </Link>
          ) : (
            <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {planLabel}
            </span>
          )}
          {branch && <BranchSwitcher {...branch} />}
        </div>
      </div>

      <div className="p-3">
        <VenderCard cashRegister={cashRegister} />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {navSections.map((section) => {
          const items = section.items.filter(
            (item) => item.href !== "/pos" && (!item.adminOnly || canSeeAdminItems)
          );
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </p>
              <div className="mt-2 space-y-0.5">
                {items.map((item) => {
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
                        "flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
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
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
