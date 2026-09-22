"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { DENOMINATIONS } from "@/lib/billetes";

export function CashCalculator({ onUseTotal }: { onUseTotal: (total: number) => void }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});

  const total = useMemo(
    () => DENOMINATIONS.reduce((acc, value) => acc + value * (Number(counts[value]) || 0), 0),
    [counts]
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Calculator className="h-3.5 w-3.5" />
        Calculadora de billetes y monedas
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Contá cuánto tenés de cada billete</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cerrar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DENOMINATIONS.map((value) => (
          <div key={value} className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">
              {formatCurrency(value)}
            </span>
            <Input
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              value={counts[value] ?? ""}
              onChange={(e) => setCounts((c) => ({ ...c, [value]: e.target.value }))}
              placeholder="0"
              className="h-8 px-2 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-sm font-semibold text-foreground">
          Total contado: {formatCurrency(total)}
        </span>
        <Button type="button" size="sm" onClick={() => onUseTotal(total)} disabled={total === 0}>
          Usar este total
        </Button>
      </div>
    </div>
  );
}
