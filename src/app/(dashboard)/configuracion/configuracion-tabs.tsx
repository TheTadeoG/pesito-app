import Link from "next/link";
import { cn } from "@/lib/utils";

export type ConfiguracionTab = "negocio" | "plan";

const tabs: { value: ConfiguracionTab; label: string; href: string }[] = [
  { value: "negocio", label: "Negocio", href: "/configuracion" },
  { value: "plan", label: "Plan", href: "/configuracion?tab=plan" },
];

export function ConfiguracionTabs({ active }: { active: ConfiguracionTab }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-muted/50 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          prefetch={false}
          aria-current={active === tab.value ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === tab.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
