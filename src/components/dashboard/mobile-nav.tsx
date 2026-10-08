"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { navSections, isNavItemActive } from "@/lib/nav";
import { Wordmark } from "@/components/marketing/wordmark";
import { cn } from "@/lib/utils";
import { ThemeMenuItem } from "@/components/theme-toggle";
import { signOut } from "@/app/(auth)/actions";
import { BranchSwitcher, type BranchSwitcherProps } from "@/components/dashboard/branch-switcher";

export function MobileNav({
  orgName,
  branch,
  alerts = {},
}: {
  orgName: string;
  branch?: BranchSwitcherProps | null;
  alerts?: Record<string, number>;
}) {
  const hasAlerts = Object.values(alerts).some((n) => n > 0);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-foreground lg:hidden"
        aria-label={hasAlerts ? "Abrir menú (hay avisos)" : "Abrir menú"}
      >
        <Menu className="h-5 w-5" />
        {hasAlerts && <i className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-background" />}
      </button>

      {/* Portal a document.body: el encabezado tiene backdrop-blur, y eso hace que un
          "fixed" adentro se mida contra el encabezado (el menú quedaba cortado a su
          altura). `open` sólo es true después de un clic, así que document ya existe. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-72 flex-col bg-sidebar shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Wordmark className="text-lg" />
                <span className="truncate border-l border-border pl-2 text-sm font-medium text-muted-foreground">
                  {orgName}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {branch && branch.branches.length > 1 && (
              <div className="border-b border-border px-4 py-3">
                <BranchSwitcher {...branch} />
              </div>
            )}

            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {section.title}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {section.items.map((item) => {
                      const active = isNavItemActive(item, pathname, tabParam);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={false}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium",
                            active
                              ? "bg-sidebar-active-bg text-sidebar-active-foreground"
                              : "text-sidebar-foreground hover:bg-muted"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.label}</span>
                          {(alerts[item.href] ?? 0) > 0 && (
                            <span
                              className="min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-[10px] font-bold text-white"
                              aria-label={`${alerts[item.href]} con deuda vencida`}
                            >
                              {alerts[item.href]}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* En el celular, el tema y salir van acá (en la barra de arriba no entran). */}
            <div className="space-y-0.5 border-t border-border px-3 py-3">
              <ThemeMenuItem className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-muted" />
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="flex-1 text-left">Cerrar sesión</span>
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
