"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { ValuationBreakdownCard } from "@/components/dashboard/valuation-lists";
import { loadStockBreakdown, type StockBreakdown } from "@/app/(dashboard)/reportes/stock-breakdown-action";
import { featureMinPlan } from "@/lib/plan-access";

/**
 * "Ver por marca y proveedor" dentro de Stock valorizado: se carga al tocarlo. Sin gestión de stock
 * (Plan Gratis) muestra el aviso con el plan que lo trae.
 */
export function StockBreakdownSection({ locked }: { locked: boolean }) {
  const [state, setState] = useState<{ data: StockBreakdown | null; loading: boolean; error: string | null }>({
    data: null,
    loading: false,
    error: null,
  });

  async function load() {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await loadStockBreakdown();
      setState({ data: res.data ?? null, loading: false, error: res.error ?? null });
    } catch {
      setState({ data: null, loading: false, error: "No pudimos calcularlo. Probá de nuevo." });
    }
  }

  if (locked) {
    return (
      <div className="col-span-2">
        <PlanLockNote plan={featureMinPlan.stockManagement}>
          Con el Plan Esencial ves cuánta plata tenés en mercadería por marca y por proveedor.
        </PlanLockNote>
      </div>
    );
  }

  return (
    <div className="col-span-2 space-y-4">
      {!state.data && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={state.loading} onClick={() => void load()}>
            {state.loading ? "Calculando…" : "Ver por marca y proveedor"}
          </Button>
          {state.error && <span className="text-sm text-danger">{state.error}</span>}
        </div>
      )}
      {state.data && (
        <div className="grid gap-4 xl:grid-cols-2">
          <ValuationBreakdownCard title="Por marca" rows={state.data.byBrand} />
          <ValuationBreakdownCard title="Por proveedor" rows={state.data.bySupplier} />
        </div>
      )}
    </div>
  );
}
