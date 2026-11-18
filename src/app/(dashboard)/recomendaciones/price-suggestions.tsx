"use client";

import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { useMemo, useState, useTransition } from "react";
import { Check, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SortTh, compareBy, nextSort, type SortState } from "@/components/dashboard/sortable-th";
import { useToast } from "@/components/toast/toast-provider";
import { formatCurrency } from "@/lib/utils";
import { applyPriceSuggestions } from "@/app/(dashboard)/recomendaciones/actions";

export interface PriceSuggestionItem {
  productId: string;
  name: string;
  brand: string | null;
  price: number;
  cost: number;
  suggestedPrice: number;
  currentMarkup: number;
  suggestedMarkup: number;
  reason: "costo-subio" | "perdida" | "margen-bajo";
  detail: string;
}

const reasonLabel: Record<PriceSuggestionItem["reason"], string> = {
  perdida: "Vendés a pérdida",
  "costo-subio": "El costo subió",
  "margen-bajo": "Margen bajo",
};

export function PriceSuggestions({
  items,
  canApply,
}: {
  items: PriceSuggestionItem[];
  canApply: boolean;
}) {
  const { showSuccess, showWarning } = useToast();
  const [rows, setRows] = useState(items);
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useState<SortState<"producto" | "motivo" | "costo" | "precio" | "cambio">>({ key: "cambio", dir: -1 });
  const sorted = useMemo(() => {
    const val = (r: PriceSuggestionItem): string | number =>
      sort.key === "producto" ? r.name.toLowerCase()
      : sort.key === "motivo" ? reasonLabel[r.reason]
      : sort.key === "costo" ? r.cost
      : sort.key === "precio" ? r.price
      : r.price > 0 ? (r.suggestedPrice - r.price) / r.price : 0;
    return [...rows].sort((a, b) => compareBy(val(a), val(b), sort.dir));
  }, [rows, sort]);
  const pager = usePagination(rows.length, `${rows.length}|${sort.key}${sort.dir}`, "pesito-precios-page-size");

  function apply(chosen: PriceSuggestionItem[]) {
    startTransition(async () => {
      const result = await applyPriceSuggestions(
        chosen.map((c) => ({ productId: c.productId, price: c.suggestedPrice }))
      );
      if (result.error) {
        showWarning(result.error);
        return;
      }
      const done = new Set(result.applied);
      setRows((current) => current.filter((r) => !done.has(r.productId)));
      if (result.failed > 0) showWarning(`No pudimos actualizar ${result.failed} precios.`);
      if (done.size > 0) {
        showSuccess(done.size === 1 ? "Precio actualizado" : `${done.size} precios actualizados`);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Check className="h-5 w-5 text-success" />
          Tus precios están al día: ningún producto pide cambios por costo o margen.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {rows.length === 1 ? "1 producto" : `${rows.length} productos`} con el precio para revisar.
          </p>
          {canApply && (
            <Button size="sm" disabled={pending} onClick={() => apply(rows)}>
              Aplicar todos
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <SortTh label="Producto" k="producto" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k, 1))} className="pl-0" />
                <SortTh label="Motivo" k="motivo" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k, 1))} />
                <SortTh label="Costo" k="costo" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k, -1))} right />
                <SortTh label="Precio hoy" k="precio" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k, -1))} right />
                <SortTh label="Sugerido" k="cambio" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k, -1))} right />
                <th className="px-3 py-2.5 text-right">Ganancia sobre costo</th>
                {canApply && <th className="py-2.5 pl-3 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(pager.start, pager.end).map((r) => (
                <tr key={r.productId} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-foreground">{r.name}</p>
                    {r.brand && <p className="text-xs text-muted-foreground">{r.brand}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={r.reason === "perdida" ? "danger" : "warning"}>{reasonLabel[r.reason]}</Badge>
                    <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">{r.detail}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(r.cost)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground line-through">{formatCurrency(r.price)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-foreground">{formatCurrency(r.suggestedPrice)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                    {`${Math.round(r.currentMarkup)}% → `}
                    <span className="font-semibold text-foreground">{`${Math.round(r.suggestedMarkup)}%`}</span>
                  </td>
                  {canApply && (
                    <td className="py-3 pl-3 text-right">
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => apply([r])}>
                        <Tag className="mr-1 h-3.5 w-3.5" />
                        Aplicar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <PaginationBar
        total={rows.length}
        page={pager.page}
        pageSize={pager.pageSize}
        noun="productos"
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
      />
    </Card>
  );
}
