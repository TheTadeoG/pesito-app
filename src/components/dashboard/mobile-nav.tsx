"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Menu, X } from "lucide-react";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav({ orgName }: { orgName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-72 flex-col bg-sidebar shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Banknote className="h-4 w-4" />
                </span>
                {orgName}
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

            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {section.title}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {section.items.map((item) => {
                      const active =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium",
                            active
                              ? "bg-sidebar-active-bg text-sidebar-active-foreground"
                              : "text-sidebar-foreground hover:bg-muted"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
