"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { combinations, parseList, variantName, variantSku } from "@/lib/variants";
import { cn } from "@/lib/utils";
import type { VariantInput } from "@/app/(dashboard)/productos/actions";

/** Lo que el formulario guarda de las variantes: lo escrito en talles y colores, y lo que se editó de cada fila. */
export interface VariantsState {
  enabled: boolean;
  sizesText: string;
  colorsText: string;
  /** Cambios a mano por variante ("talle|color" en minúsculas): lo que no se tocó se arma solo. */
  edits: Record<string, Partial<Record<"sku" | "barcode" | "stock" | "price", string>>>;
}

export const EMPTY_VARIANTS: VariantsState = { enabled: false, sizesText: "", colorsText: "", edits: {} };

const keyOf = (size: string, color: string) => `${size.toLowerCase()}|${color.toLowerCase()}`;

/** Filas de variantes listas para mostrar y guardar: cada combinación con su SKU, código, stock y precio. */
export function resolveVariantRows(state: VariantsState, baseSku: string, basePrice: string) {
  const combos = combinations(parseList(state.sizesText), parseList(state.colorsText));
  return combos.map(({ size, color }) => {
    const edit = state.edits[keyOf(size, color)] ?? {};
    return {
      key: keyOf(size, color),
      size,
      color,
      sku: edit.sku ?? variantSku(baseSku, size, color),
      barcode: edit.barcode ?? "",
      stock: edit.stock ?? "0",
      price: edit.price ?? basePrice,
    };
  });
}

/** Las filas como las espera el servidor. */
export function toVariantInputs(rows: ReturnType<typeof resolveVariantRows>): VariantInput[] {
  return rows.map((r) => ({ size: r.size, color: r.color, sku: r.sku, barcode: r.barcode, stock: Number(r.stock) || 0, price: Number(r.price) || 0 }));
}

export function VariantsSection({
  state,
  onChange,
  locked,
  baseName,
  baseSku,
  basePrice,
  sizeSuggestions,
  colorSuggestions,
  showStock,
}: {
  state: VariantsState;
  onChange: (next: VariantsState) => void;
  /** El plan no incluye variantes (Plan Esencial). */
  locked: boolean;
  baseName: string;
  baseSku: string;
  basePrice: string;
  sizeSuggestions: string[];
  colorSuggestions: string[];
  /** Con false (el stock entra por la compra) no se pide el stock inicial. */
  showStock: boolean;
}) {
  const rows = useMemo(() => resolveVariantRows(state, baseSku, basePrice), [state, baseSku, basePrice]);
  const pg = usePagination(rows.length, `${state.sizesText}|${state.colorsText}`, "pesito-variantes-pagesize");

  function edit(key: string, field: "sku" | "barcode" | "stock" | "price", value: string) {
    onChange({ ...state, edits: { ...state.edits, [key]: { ...state.edits[key], [field]: value } } });
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3.5">
      <label className={cn("flex items-start gap-2.5 text-sm", locked ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
        <input
          type="checkbox"
          checked={state.enabled && !locked}
          disabled={locked}
          onChange={(e) => onChange({ ...state, enabled: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span>
          <span className="font-medium text-foreground">Tiene talles o colores</span>
          <span className="block text-xs text-muted-foreground">Cargás una sola vez el producto y cada talle y color queda con su propio SKU, stock y precio.</span>
        </span>
      </label>
      {locked && (
        <PlanLockNote plan="basico" className="mt-3">
          Los talles y colores están desde el Plan Básico.
        </PlanLockNote>
      )}

      {state.enabled && !locked && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="v-sizes">Talles</Label>
              <Input
                id="v-sizes"
                list="v-size-suggestions"
                value={state.sizesText}
                onChange={(e) => onChange({ ...state, sizesText: e.target.value })}
                placeholder="Ej: S, M, L, XL  o  38, 40, 42"
              />
              <datalist id="v-size-suggestions">
                {sizeSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="v-colors">Colores</Label>
              <Input id="v-colors" list="v-color-suggestions" value={state.colorsText} onChange={(e) => onChange({ ...state, colorsText: e.target.value })} placeholder="Ej: Azul, Negro, Blanco" />
              <datalist id="v-color-suggestions">
                {colorSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Separá con comas. Se arma una variante por cada combinación; podés usar sólo talles o sólo colores
            {sizeSuggestions.length + colorSuggestions.length > 0 ? " (te sugerimos los que ya usaste)" : ""}.
          </p>

          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{`${rows.length} variante${rows.length === 1 ? "" : "s"}`}</p>
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-2">Variante</th>
                      <th className="px-2.5 py-2">SKU</th>
                      <th className="px-2.5 py-2">Código de barras</th>
                      {showStock && <th className="px-2.5 py-2">Stock</th>}
                      <th className="px-2.5 py-2">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(pg.start, pg.end).map((r) => (
                      <tr key={r.key} className="border-t border-border align-middle">
                        <td className="max-w-[10rem] truncate px-2.5 py-1.5 font-medium text-foreground" title={variantName(baseName || "Producto", r.size, r.color)}>
                          {[r.size, r.color].filter(Boolean).join(" · ")}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <Input value={r.sku} onChange={(e) => edit(r.key, "sku", e.target.value)} maxLength={60} aria-label={`SKU de ${r.size} ${r.color}`} className="h-8 min-w-[12rem]" />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <Input value={r.barcode} onChange={(e) => edit(r.key, "barcode", e.target.value)} aria-label={`Código de barras de ${r.size} ${r.color}`} className="h-8 min-w-[8rem]" placeholder="Opcional" />
                        </td>
                        {showStock && (
                          <td className="px-2.5 py-1.5">
                            <Input type="number" min={0} step="0.01" value={r.stock} onChange={(e) => edit(r.key, "stock", e.target.value)} aria-label={`Stock de ${r.size} ${r.color}`} className="h-8 w-20" />
                          </td>
                        )}
                        <td className="px-2.5 py-1.5">
                          <Input type="number" min={0} step="0.01" value={r.price} onChange={(e) => edit(r.key, "price", e.target.value)} aria-label={`Precio de ${r.size} ${r.color}`} className="h-8 w-24" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar total={rows.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} noun="variantes" />
              </div>
              <p className="text-xs text-muted-foreground">El SKU de cada variante se arma con el SKU base de arriba: podés cambiarlo. El costo y los demás datos son los mismos para todas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
