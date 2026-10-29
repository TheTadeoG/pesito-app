import Link from "next/link";
import { cn } from "@/lib/utils";
import { reportesHref, type ReportQuery, type ReportTab } from "@/lib/report-periods";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "resumen", label: "Resumen general" },
  { id: "ventas", label: "Ventas" },
  { id: "caja", label: "Caja" },
  { id: "otros", label: "Otros reportes" },
];

// Dentro de Ventas y de Caja hay dos vistas: el análisis (números y
// rankings, en /reportes) y lo que se opera o consulta (historial de ventas
// en /ventas, caja del día en /caja).
const SUBS: Partial<Record<ReportTab, { id: string; label: string; href: (q?: ReportQuery) => string }[]>> = {
  ventas: [
    { id: "analisis", label: "Análisis", href: (q) => tabHref("ventas", q) },
    { id: "historial", label: "Historial de ventas", href: () => "/ventas" },
  ],
  caja: [
    { id: "analisis", label: "Análisis", href: (q) => tabHref("caja", q) },
    { id: "dia", label: "Caja y cierres", href: () => "/caja" },
  ],
};

function tabHref(tab: ReportTab, query?: ReportQuery) {
  if (query) return reportesHref({ ...query, tab });
  return tab === "resumen" ? "/reportes" : `/reportes?tab=${tab}`;
}

/**
 * Solapas de Reportes. Se muestran arriba de /reportes, /ventas y /caja: las
 * tres son "Reportes" en el menú. `sub` marca la vista de adentro.
 */
export function ReportesTabs({
  active,
  sub = "analisis",
  query,
}: {
  active: ReportTab;
  sub?: string;
  query?: ReportQuery;
}) {
  const subs = SUBS[active];
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
      {subs && (
        <div className="inline-flex gap-0.5 rounded-xl border border-border bg-muted p-0.5">
          {subs.map((s) => (
            <Link
              key={s.id}
              href={s.href(query)}
              prefetch={false}
              aria-current={s.id === sub ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                s.id === sub ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
