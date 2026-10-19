"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { formatCurrency } from "@/lib/utils";

export interface RotationRow {
  id: string;
  name: string;
  unit: string;
  stockLabel: string;
  /** Plata parada a costo; null si el producto no tiene costo. */
  capital: number | null;
  /** Ya armado en el servidor ("Última venta hace 40 días", "Vendiste 3 u en 90 días…"). */
  detail: string;
}

/** Los productos de baja rotación, de a 25, 50, 100 o 200 por página (de más a menos plata parada). */
export function RotationList({ rows, days }: { rows: RotationRow[]; days: number }) {
  const pager = usePagination(rows.length, String(days), "pesito-rotacion-page-size");
  return (
    <Card>
      <CardContent className="divide-y divide-border py-2">
        {rows.slice(pager.start, pager.end).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.detail}</p>
            </div>
            <p className="text-sm text-muted-foreground">{r.stockLabel}</p>
            <p className="w-28 text-right text-sm font-semibold text-foreground">
              {r.capital === null ? "Sin costo" : formatCurrency(r.capital)}
            </p>
          </div>
        ))}
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
