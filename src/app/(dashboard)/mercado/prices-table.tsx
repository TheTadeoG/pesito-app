"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { PlanLockNote, PlanPill } from "@/components/dashboard/pro-locked-card";
import { positionLabels, type PricePosition } from "@/lib/market-prices";
import type { Plan } from "@/lib/subscription";
import { cn, formatCurrency } from "@/lib/utils";

export interface PriceRow {
  id: string;
  name: string;
  brand: string | null;
  ean: string;
  price: number;
  stores: Record<string, number>;
  min: number;
  max: number;
  median: number;
  diff: number | null;
  position: PricePosition | null;
  suggested: number | null;
  reason: string | null;
}

type Filter = "todos" | "caro" | "barato" | "en-rango";

const positionTone: Record<PricePosition, string> = {
  "muy-barato": "bg-accent text-accent-foreground",
  barato: "bg-accent text-accent-foreground",
  "en-rango": "bg-success-bg text-success",
  caro: "bg-warning-bg text-warning",
  "muy-caro": "bg-danger-bg text-danger",
};

function matches(r: PriceRow, f: Filter): boolean {
  if (f === "todos") return true;
  if (f === "caro") return r.position === "caro" || r.position === "muy-caro";
  if (f === "barato") return r.position === "barato" || r.position === "muy-barato";
  return r.position === "en-rango";
}

export function PricesTable({
  rows,
  insights,
  initialFilter,
  totalWithEan,
  totalProducts,
  lastMonth,
  stores,
  locked,
}: {
  rows: PriceRow[];
  insights: boolean;
  initialFilter: Filter;
  totalWithEan: number;
  totalProducts: number;
  lastMonth: string | null;
  stores: { id: string; label: string }[];
  locked: { plan: Plan; high: number; low: number } | null;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => matches(r, filter) && (!q || `${r.name} ${r.brand ?? ""} ${r.ean}`.toLowerCase().includes(q)));
  }, [rows, query, filter]);
  const pager = usePagination(shown.length, `${query}|${filter}`, "pesito-mercado-page-size");
  const page = shown.slice(pager.start, pager.end);
  const month = lastMonth ? new Date(`${lastMonth}T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" }) : null;

  return (
    <>
      <div>
        <h2 className="text-base font-semibold text-foreground">Precios de supermercados</h2>
        <p className="text-sm text-muted-foreground">
          {`Lo que cuestan tus productos con código de barras en ${stores.map((s) => s.label).join(", ")}. Se actualiza una vez por mes${month ? ` (último dato: ${month})` : ""}. Son precios de la tienda online: orientativos.`}
        </p>
      </div>

      {locked && (locked.high > 0 || locked.low > 0) && (
        <PlanLockNote plan={locked.plan} cta="Ver el Plan IA">
          {`${locked.high > 0 ? `${locked.high} de tus productos están más caros que los supermercados` : ""}${locked.high > 0 && locked.low > 0 ? " y " : ""}${locked.low > 0 ? `${locked.low} más baratos` : ""}. Con el Plan IA ves cuáles, el precio sugerido y recibís avisos.`}
        </PlanLockNote>
      )}
      {locked && locked.high === 0 && locked.low === 0 && rows.length > 0 && (
        <PlanLockNote plan={locked.plan} cta="Ver el Plan IA">
          Con el Plan IA ves si estás caro o barato frente a los supermercados, el precio sugerido y recibís avisos.
        </PlanLockNote>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {totalWithEan === 0
              ? `Ninguno de tus ${totalProducts} productos tiene código de barras. Cargalo en cada producto y, cuando juntemos los precios del mes, aparece acá.`
              : `Todavía no juntamos precios de tus ${totalWithEan} productos con código de barras. Se van sumando durante el mes: volvé en unos días.`}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-52 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o código…" className="pl-9" />
              </div>
              {insights ? (
                <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-auto">
                  <option value="todos">Todos</option>
                  <option value="caro">Más caros que el súper</option>
                  <option value="barato">Más baratos que el súper</option>
                  <option value="en-rango">En rango</option>
                </Select>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  Filtrar por caro/barato <PlanPill plan="ia" />
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Producto</th>
                    <th className="px-2 py-2 text-right font-medium">Tu precio</th>
                    {stores.map((s) => (
                      <th key={s.id} className="px-2 py-2 text-right font-medium">{s.label}</th>
                    ))}
                    <th className="px-2 py-2 text-right font-medium">Mediana</th>
                    <th className="py-2 pl-2 text-right font-medium">{insights ? "Comparación" : <PlanPill plan="ia" />}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 align-top last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{`${r.brand ? `${r.brand} · ` : ""}${r.ean}`}</div>
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-foreground">{formatCurrency(r.price)}</td>
                      {stores.map((s) => (
                        <td
                          key={s.id}
                          className={cn(
                            "px-2 py-2.5 text-right tabular-nums text-muted-foreground",
                            r.stores[s.id] !== undefined && r.stores[s.id] === r.min && "font-semibold text-success"
                          )}
                        >
                          {r.stores[s.id] !== undefined ? formatCurrency(r.stores[s.id]) : "—"}
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-right tabular-nums text-foreground">{formatCurrency(r.median)}</td>
                      <td className="py-2.5 pl-2 text-right">
                        {insights && r.position ? (
                          <div className="space-y-1">
                            <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", positionTone[r.position])}>
                              {`${positionLabels[r.position]}${r.diff !== null ? ` (${r.diff > 0 ? "+" : ""}${r.diff}%)` : ""}`}
                            </span>
                            {r.suggested !== null && r.suggested !== r.price && (
                              <div className="text-xs text-muted-foreground" title={r.reason ?? undefined}>
                                {`Sugerido: ${formatCurrency(r.suggested)}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nada coincide con la búsqueda.</p>}
            <PaginationBar
              total={shown.length}
              page={pager.page}
              pageSize={pager.pageSize}
              onPageChange={pager.setPage}
              onPageSizeChange={pager.setPageSize}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
