"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const catalog = [
  { code: "7790001", name: "Gaseosa cola 1.5L", price: 2200, stock: 4 },
  { code: "7790002", name: "Alfajor triple", price: 900, stock: 12 },
  { code: "7790003", name: "Chicles menta", price: 500, stock: 30 },
  { code: "7790004", name: "Yerba 1 kg", price: 3800, stock: 9 },
  { code: "7790005", name: "Pan lactal", price: 2600, stock: 7 },
];

const initialQty: Record<string, number> = { "7790001": 1, "7790002": 2, "7790003": 1 };

const ars = (n: number) => `$${n.toLocaleString("es-AR")}`;

// Demo de cobro de la portada: se puede tocar para sumar productos y cobrar.
// Es sólo de ejemplo: no guarda nada.
export function PosMockup() {
  const [qty, setQty] = useState<Record<string, number>>(initialQty);
  const [paid, setPaid] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const items = catalog.filter((item) => qty[item.code] > 0);
  const total = items.reduce((acc, item) => acc + item.price * qty[item.code], 0);

  function change(code: string, delta: number) {
    const item = catalog.find((c) => c.code === code);
    if (!item) return;
    setQty((prev) => {
      const next = Math.min(item.stock, Math.max(0, (prev[code] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[code];
      else copy[code] = next;
      return copy;
    });
  }

  function charge() {
    if (total === 0) return;
    setPaid(total);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPaid(null);
      setQty(initialQty);
    }, 2200);
  }

  return (
    <div>
      <div className="relative w-full rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-2xl shadow-black/40 sm:p-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Escaneá o buscá un producto…</span>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {catalog.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => change(item.code, 1)}
              className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary"
            >
              + {item.name}
            </button>
          ))}
        </div>

        <div className="min-h-[9.5rem] space-y-2">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Tocá un producto de arriba para empezar la venta.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.code}
                className="animate-line-in flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{ars(item.price)}</span>
                    {item.stock - qty[item.code] <= 5 && (
                      <Badge tone="danger" className="px-1.5 py-0 text-[10px]">
                        Stock {item.stock - qty[item.code]}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Restar ${item.name}`}
                    onClick={() => change(item.code, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-transform active:scale-90"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-4 text-center text-sm font-medium tabular-nums">
                    {qty[item.code]}
                  </span>
                  <button
                    type="button"
                    aria-label={`Sumar ${item.name}`}
                    onClick={() => change(item.code, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-transform active:scale-90"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Quitar ${item.name}`}
                    onClick={() => change(item.code, -qty[item.code])}
                    className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <span className="text-xl font-bold tabular-nums text-foreground">{ars(total)}</span>
        </div>

        <button
          type="button"
          onClick={charge}
          disabled={total === 0}
          className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-primary-hover active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
        >
          Cobrar venta
        </button>

        <div
          aria-live="polite"
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-card text-center transition-[opacity,transform] duration-200 ease-out ${
            paid !== null ? "scale-100 opacity-100" : "pointer-events-none scale-[0.97] opacity-0"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-bg text-success">
            <Check className="h-6 w-6" />
          </span>
          <p className="mt-2 text-lg font-bold text-foreground">Venta cobrada {ars(paid ?? 0)}</p>
          <p className="text-sm text-muted-foreground">El stock ya se descontó.</p>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-deep-muted">
        Probalo: sumá productos y cobrá. Es una demo de ejemplo.
      </p>
    </div>
  );
}
