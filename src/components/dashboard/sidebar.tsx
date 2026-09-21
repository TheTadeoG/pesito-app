"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store } from "lucide-react";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { CajaWidget } from "@/components/dashboard/caja-widget";

interface SidebarProps {
  orgName: string;
  memberLabel: string;
  cashRegister: {
    openedAt: string;
    openingAmount: number;
    cashTotal: number;
  } | null;
}

export function Sidebar({ orgName, memberLabel, cashRegister }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{orgName}</p>
          <p className="truncate text-xs text-muted-foreground">{memberLabel}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </p>
            <div className="mt-2 space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
                    {item.badge && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <CajaWidget cashRegister={cashRegister} />
      </div>
    </aside>
  );
}
