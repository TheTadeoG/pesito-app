import Link from "next/link";
import { cn } from "@/lib/utils";

export type CatalogTab = "productos" | "movimientos" | "marcas";

const tabs: { value: CatalogTab; label: string; href: string }[] = [
  { value: "productos", label: "Productos", href: "/productos" },
  { value: "movimientos", label: "Movimientos", href: "/productos?tab=movimientos" },
];

/**
 * Alterna entre la lista de Productos (con su stock) y los Movimientos de
 * stock. Marcas se abre desde Acciones y, estando ahí, aparece como una
 * tercera opción para volver a ver dónde se está.
 */
export function CatalogTabs({ active }: { active: CatalogTab }) {
  const visible = active === "marcas" ? [...tabs, { value: "marcas" as const, label: "Marcas", href: "/productos?tab=marcas" }] : tabs;
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-muted/50 p-1">
      {visible.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          aria-current={active === tab.value ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
