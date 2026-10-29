import Link from "next/link";
import { cn } from "@/lib/utils";
import { reportesHref, type ReportQuery, type ReportTab } from "@/lib/report-periods";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "resumen", label: "Resumen general" },
  { id: "ventas", label: "Ventas" },
  { id: "caja", label: "Caja" },
  { id: "otros", label: "Otros reportes" },
];

function tabHref(tab: ReportTab, query?: ReportQuery) {
  if (tab === "ventas") return "/ventas";
  // Caja: la caja del día, el resumen del equipo y el historial de cierres.
  if (tab === "caja") return "/caja";
  if (query) return reportesHref({ ...query, tab });
  return tab === "resumen" ? "/reportes" : `/reportes?tab=${tab}`;
}

/**
 * Solapas de Reportes. Se muestran arriba de /reportes, /ventas y /caja: las
 * tres son "Reportes" en el menú.
 */
export function ReportesTabs({
  active,
  query,
}: {
  active: ReportTab;
  query?: ReportQuery;
}) {
  return (
    <div className="space-y-3">
      <nav aria-label="Reportes" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tabHref(tab.id, query)}
            prefetch={false}
            aria-current={tab.id === active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors",
              tab.id === active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
