"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExampleRow {
  name: string;
  before: number;
  after: number;
}

const ars = (n: number) => `$${n.toLocaleString("es-AR")}`;

// Tarjeta de ejemplo del aumento masivo: al tocar "Aplicar" los precios viejos
// se reemplazan por los nuevos. Es sólo ilustrativa: no guarda nada.
export function BulkPricesCard({ rows }: { rows: ExampleRow[] }) {
  const [applied, setApplied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function apply() {
    setApplied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setApplied(false), 4200);
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 text-card-foreground shadow-2xl shadow-black/30">
      <p className="text-sm font-semibold text-foreground">Aumentar precios</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border px-3.5 py-2.5">
          <p className="text-xs text-muted-foreground">Proveedor</p>
          <p className="font-medium text-foreground">Distribuidora Norte</p>
        </div>
        <div className="rounded-xl border border-border px-3.5 py-2.5">
          <p className="text-xs text-muted-foreground">Aumento</p>
          <p className="font-medium text-foreground">+13%</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
            <span className="truncate text-foreground">{row.name}</span>
            <span className="grid shrink-0 justify-items-end tabular-nums">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-muted-foreground transition-[opacity,transform] duration-300 ease-out [grid-area:1/1]",
                  applied && "-translate-y-2 opacity-0"
                )}
              >
                <span className="line-through">{ars(row.before)}</span>
                <ArrowRight className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{ars(row.after)}</span>
              </span>
              <span
                className={cn(
                  "font-semibold text-primary transition-[opacity,transform] delay-75 duration-300 ease-out [grid-area:1/1]",
                  applied ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                )}
              >
                {ars(row.after)}
              </span>
            </span>
          </div>
        ))}
        <div className="px-3.5 py-2.5 text-center text-xs text-muted-foreground">
          y 145 productos más
        </div>
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={applied}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]",
          applied
            ? "bg-success-bg text-success"
            : "bg-primary text-primary-foreground hover:bg-primary-hover"
        )}
      >
        {applied ? (
          <>
            <Check className="h-4 w-4" />
            Precios actualizados
          </>
        ) : (
          "Aplicar a 148 productos"
        )}
      </button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Ejemplo ilustrativo.</p>
    </div>
  );
}
