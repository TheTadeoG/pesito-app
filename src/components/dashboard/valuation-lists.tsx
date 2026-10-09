"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export interface ValuationRow {
  label: string;
  units: number;
  /** Plata en mercadería: stock × costo. */
  value: number;
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const BREAKDOWN_PREVIEW = 8;

/** Lista de cuánta plata hay en mercadería por marca o por proveedor, de mayor a menor (8 y "Ver las N"). */
export function ValuationBreakdownCard({ title, rows }: { title: string; rows: ValuationRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const maxValue = rows[0]?.value ?? 0;
  const shown = showAll ? rows : rows.slice(0, BREAKDOWN_PREVIEW);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Sin datos todavía.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {shown.map((row) => (
              <div key={row.label} className="space-y-1.5 px-5 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">{row.label}</span>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatCurrency(row.value)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: maxValue > 0 ? `${Math.max((row.value / maxValue) * 100, 2)}%` : "0%",
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatQty(row.units)} un.
                  </span>
                </div>
              </div>
            ))}
            {rows.length > BREAKDOWN_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full px-5 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted"
              >
                {showAll ? "Ver menos" : `Ver las ${rows.length}`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
