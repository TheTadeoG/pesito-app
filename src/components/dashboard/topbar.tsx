"use client";

import { usePathname } from "next/navigation";
import { HelpCircle, LogOut } from "lucide-react";
import { pageTitles } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  orgName: string;
  userLabel: string;
  greetingName?: string | null;
}

export function Topbar({ orgName, userLabel, greetingName }: TopbarProps) {
  const pathname = usePathname();
  const page = pageTitles[pathname] ?? { title: orgName, description: "" };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav orgName={orgName} />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{page.title}</h1>
          {page.description && (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {page.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label="Ayuda">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <span className="hidden text-sm text-muted-foreground sm:inline">
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
    </header>
  );
}
