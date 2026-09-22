import Link from "next/link";
import { cn } from "@/lib/utils";

export type CatalogTab = "productos" | "stock" | "marcas";

const tabs: { value: CatalogTab; label: string; href: string }[] = [
  { value: "productos", label: "Productos", href: "/productos" },
  { value: "stock", label: "Stock", href: "/productos?tab=stock" },
  { value: "marcas", label: "Marcas", href: "/productos?tab=marcas" },
];

export function CatalogTabs({
  active,
  lowStockCount,
}: {
  active: CatalogTab;
  lowStockCount: number;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-muted/50 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          aria-current={active === tab.value ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === tab.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {tab.value === "stock" && lowStockCount > 0 && (
            <span
              className="rounded-full bg-danger-bg px-1.5 text-xs font-semibold text-danger"
              title={`${lowStockCount} por debajo del stock mínimo`}
            >
              {lowStockCount}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
