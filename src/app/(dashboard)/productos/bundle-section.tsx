"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency } from "@/lib/utils";

/** Un producto que se puede poner dentro de un combo. */
export interface BundleComponentOption {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  cost: number | null;
  stock: number;
  unit: string;
}

export interface BundleItemState {
  componentId: string;
  /** Texto del campo (se convierte a número al guardar). */
  quantity: string;
}

export type BundlePriceMode = "fixed" | "discount";

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: string) => Number(v.replace(",", ".")) || 0;

/** Cuántos combos se pueden armar con el stock de los componentes (sin contar lo que ya está reservado). */
export function bundleCapacity(items: { quantity: number; stock: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(0, Math.min(...items.map((i) => Math.floor((i.stock + 1e-9) / (i.quantity || 1)))));
}

/**
 * Armar un combo o kit: qué productos lleva y cuántos de cada uno, y cómo se define el precio (fijo, o la suma menos un
 * descuento). El costo es la suma de los costos y no se carga a mano.
 */
export function BundleSection({
  catalog,
  items,
  onItemsChange,
  mode,
  onModeChange,
  price,
  onPriceChange,
  discountPct,
  onDiscountChange,
  excludeId,
}: {
  catalog: BundleComponentOption[];
  items: BundleItemState[];
  onItemsChange: (next: BundleItemState[]) => void;
  mode: BundlePriceMode;
  onModeChange: (mode: BundlePriceMode) => void;
  price: string;
  onPriceChange: (v: string) => void;
  discountPct: string;
  onDiscountChange: (v: string) => void;
  /** El propio combo (al editarlo) no se ofrece como componente. */
  excludeId?: string;
}) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const chosen = new Set(items.map((i) => i.componentId));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((c) => c.id !== excludeId && !chosen.has(c.id) && (c.name.toLowerCase().includes(q) || c.sku.toLowerCase().includes(q) || c.barcode?.toLowerCase() === q))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, query, items, excludeId]);

  const rows = items.map((i) => ({ ...i, product: byId.get(i.componentId), qty: num(i.quantity) }));
  const sumPrice = rows.reduce((sum, r) => sum + (r.product?.price ?? 0) * r.qty, 0);
  const sumCost = rows.reduce((sum, r) => sum + (r.product?.cost ?? 0) * r.qty, 0);
  const missingCost = rows.some((r) => r.product && r.product.cost === null);
  const finalPrice = mode === "discount" ? round2(sumPrice * (1 - num(discountPct) / 100)) : num(price);
  const profit = finalPrice - sumCost;
  const impliedDiscount = sumPrice > 0 ? (1 - finalPrice / sumPrice) * 100 : 0;
  const capacity = bundleCapacity(rows.filter((r) => r.product).map((r) => ({ quantity: r.qty, stock: r.product!.stock })));

  function setQty(id: string, value: string) {
    onItemsChange(items.map((i) => (i.componentId === id ? { ...i, quantity: value } : i)));
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-3.5">
      <div>
        <p className="text-sm font-semibold text-foreground">Productos del combo</p>
        <p className="text-xs text-muted-foreground">Al vender el combo se descuenta el stock de cada uno. El combo no tiene stock propio.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar un producto para sumar al combo…" className="pl-10" aria-label="Buscar producto para el combo" />
        {query.trim() && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
            {matches.length === 0 ? (
              <p className="px-3.5 py-2.5 text-sm text-muted-foreground">No encontramos productos con ese nombre (los combos no se pueden meter dentro de otro combo).</p>
            ) : (
              matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onItemsChange([...items, { componentId: c.id, quantity: "1" }]);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate font-medium text-foreground">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{`${formatCurrency(c.price)} · stock ${c.stock}${c.unit}`}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">Todavía no sumaste productos. Buscalos arriba.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((r) => (
            <li key={r.componentId} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.product?.name ?? "Producto que ya no existe"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.product ? `${formatCurrency(r.product.price)} c/u · hay ${r.product.stock}${r.product.unit}` : "Sacalo del combo"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Cantidad</span>
                <div className="w-20">
                  <Input type="number" min={0} step="any" value={r.quantity} onChange={(e) => setQty(r.componentId, e.target.value)} aria-label={`Cantidad de ${r.product?.name ?? "producto"}`} className="h-8 text-center" />
                </div>
              </div>
              <span className="w-24 text-right text-sm font-semibold text-foreground">{r.product ? formatCurrency(r.product.price * r.qty) : "—"}</span>
              <button
                type="button"
                onClick={() => onItemsChange(items.filter((i) => i.componentId !== r.componentId))}
                aria-label={`Sacar ${r.product?.name ?? "producto"} del combo`}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <p className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Por separado suman</span>
            <span className="font-semibold text-foreground">{formatCurrency(sumPrice)}</span>
          </p>

          <div role="radiogroup" aria-label="Cómo se define el precio" className="flex flex-wrap gap-1.5">
            {([
              ["fixed", "Precio fijo"],
              ["discount", "Suma con descuento"],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => onModeChange(m)}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  mode === m ? "border-primary bg-accent text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "fixed" ? (
            <div className="space-y-1.5">
              <Label htmlFor="bundle-price" required>Precio del combo</Label>
              <div className="w-44">
                <Input id="bundle-price" type="number" min={0} step="0.01" value={price} onChange={(e) => onPriceChange(e.target.value)} placeholder="Ej: 5500" />
              </div>
              <p className="text-xs text-muted-foreground">
                {finalPrice > 0 && sumPrice > 0
                  ? impliedDiscount >= 0
                    ? `Le das ${impliedDiscount.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% de descuento respecto de comprar todo por separado.`
                    : `Queda ${Math.abs(impliedDiscount).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% más caro que por separado.`
                  : "Poné el precio al que lo vendés."}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="bundle-discount">Descuento sobre la suma (%)</Label>
              <div className="w-32">
                <Input id="bundle-discount" type="number" min={0} max={99.99} step="0.1" value={discountPct} onChange={(e) => onDiscountChange(e.target.value)} placeholder="Ej: 10" />
              </div>
              <p className="text-xs text-muted-foreground">{`El precio queda en ${formatCurrency(finalPrice)} y se actualiza solo si cambia el precio de alguno de los productos.`}</p>
            </div>
          )}

          <div className="space-y-0.5 border-t border-border pt-2 text-sm">
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">Costo (suma de los costos)</span>
              <span className="font-medium text-foreground">{formatCurrency(sumCost)}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">Ganancia por combo</span>
              <span className={cn("font-semibold", profit < 0 ? "text-danger" : "text-foreground")}>
                {`${formatCurrency(profit)}${finalPrice > 0 ? ` (${((profit / finalPrice) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)` : ""}`}
              </span>
            </p>
            {missingCost && <p className="text-xs text-warning">Algún producto no tiene costo cargado: la ganancia real es menor.</p>}
            {profit < 0 && <p className="text-xs font-medium text-danger">Con este precio vendés el combo a pérdida.</p>}
          </div>

          <p className="text-xs text-muted-foreground">{`Con el stock de hoy podés armar ${capacity} combo${capacity === 1 ? "" : "s"}.`}</p>
        </div>
      )}
    </div>
  );
}
