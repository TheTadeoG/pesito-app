"use client";

import { NAV_SHORTCUTS } from "@/lib/shortcuts";
import { useShortcutHints } from "@/lib/shortcut-hints";
import { cn } from "@/lib/utils";

/** Insignia "Alt 3" de un ítem del menú; null si la pantalla no tiene atajo o están ocultos. */
export function AltHint({ href, className }: { href: string; className?: string }) {
  const show = useShortcutHints();
  const digit = NAV_SHORTCUTS.find((s) => s.href === href)?.digit;
  if (!show || !digit) return null;
  return (
    <kbd
      className={cn(
        "shrink-0 rounded border border-border bg-card px-1 font-mono text-[10px] font-medium text-muted-foreground",
        className
      )}
      title={`Alt + ${digit}`}
    >
      {`Alt ${digit}`}
    </kbd>
  );
}
