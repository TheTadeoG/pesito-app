"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { pageTitles } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PlanLine } from "@/components/dashboard/plan-line";
import { HelpMenu } from "@/components/dashboard/help-menu";
import { AlertsBell } from "@/components/dashboard/alerts-bell";
import type { BellAlert } from "@/lib/bell-alerts";
import type { Plan } from "@/lib/subscription";
import type { BranchSwitcherProps } from "@/components/dashboard/branch-switcher";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  orgName: string;
  userLabel: string;
  greetingName?: string | null;
  branch?: BranchSwitcherProps | null;
  /** Numerito rojo por ruta (menú del celular). */
  alerts?: Record<string, number>;
  /** Rol y plan que vale hoy: en el celular se ven bajo el título. */
  roleLabel: string;
  plan: Plan;
  trial: boolean;
  role: string;
  /** Campana de avisos: lo que ya sabe el servidor, la caja abierta y el plan que desbloquea el stock. */
  bell: {
    alerts: BellAlert[];
    cash: { openedAt: string; closeTime: string | null } | null;
    stockLockedPlan: Plan | null;
  };
}

export function Topbar({ orgName, userLabel, greetingName, branch, alerts, roleLabel, plan, trial, role, bell }: TopbarProps) {
  const pathname = usePathname();
  const page = pageTitles[pathname] ?? { title: orgName, description: "" };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav orgName={orgName} branch={branch} alerts={alerts} />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{page.title}</h1>
          <PlanLine roleLabel={roleLabel} plan={plan} trial={trial} role={role} className="sm:hidden" />
          {page.description && (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {page.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AlertsBell serverAlerts={bell.alerts} cash={bell.cash} stockLockedPlan={bell.stockLockedPlan} />
        <HelpMenu orgName={orgName} />
        {/* En el celular, el tema y salir viven al pie del menú de las tres rayitas.
            (El Button trae inline-flex y le gana a "hidden": se ocultan con un contenedor.) */}
        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          <div className="mx-1 h-6 w-px bg-border" />
          <span className="text-sm text-muted-foreground">
            {greetingName ? (
              <>
                Hola, <span className="font-medium text-foreground">{greetingName}</span>
              </>
            ) : (
              userLabel
            )}
          </span>
          <form action={signOut}>
            <Button variant="outline" size="icon" aria-label="Cerrar sesión" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
