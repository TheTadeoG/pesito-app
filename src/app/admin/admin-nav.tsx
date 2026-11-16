"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Cantidad que pide atención (se muestra en rojo). */
  badge?: number;
}

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Panel interno">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
            )}
          >
            <span>{item.label}</span>
            {item.badge ? <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold leading-none text-white">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
