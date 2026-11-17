"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { colorHexFor, combinations, parseList, variantName, variantSku } from "@/lib/variants";
import { cn } from "@/lib/utils";
import type { VariantInput } from "@/app/(dashboard)/productos/actions";

/** Lo que el formulario guarda de las variantes: lo escrito en talles y colores, y lo que se editó de cada fila. */
export interface VariantsState {
  enabled: boolean;
  sizesText: string;
  colorsText: string;
  /** Cambios a mano por variante ("talle|color" en minúsculas): lo que no se tocó se arma solo. */
  edits: Record<string, Partial<Record<"sku" | "barcode" | "stock" | "price", string>>>;
  /** Combinaciones que ese talle no tiene ("talle|color" en minúsculas), para elegir los colores de cada talle. */
  excluded: string[];
  /** Color de referencia elegido a mano por color ("nombre" en minúsculas -> #rrggbb). */
  colorHex?: Record<string, string>;
  /** "same": un solo precio para todas las variantes (por defecto); "each": un precio por talle y color. */
  priceMode?: "same" | "each";
  /** Precio único para todas (vacío: el precio del producto de arriba). */
  samePrice?: string;
}

export const EMPTY_VARIANTS: VariantsState = { enabled: false, sizesText: "", colorsText: "", edits: {}, excluded: [] };

const keyOf = (size: string, color: string) => `${size.toLowerCase()}|${color.toLowerCase()}`;

/** Filas de variantes listas para mostrar y guardar: cada combinación con su SKU, código, stock y precio. */
export function resolveVariantRows(state: VariantsState, baseSku: string, basePrice: string, reserved: readonly string[] = []) {
  const combos = combinations(parseList(state.sizesText), parseList(state.colorsText)).filter(({ size, color }) => !state.excluded.includes(keyOf(size, color)) && !reserved.includes(keyOf(size, color)));
  return combos.map(({ size, color }) => {
    const edit = state.edits[keyOf(size, color)] ?? {};
    return {
      key: keyOf(size, color),
      size,
      color,
      colorHex: state.colorHex?.[color.toLowerCase()],
      sku: edit.sku ?? variantSku(baseSku, size, color),
      barcode: edit.barcode ?? "",
      stock: edit.stock ?? "0",
      price: state.priceMode === "each" ? (edit.price ?? state.samePrice ?? basePrice) : (state.samePrice ?? basePrice),
    };
  });
}

/** Las filas como las espera el servidor. */
export function toVariantInputs(rows: ReturnType<typeof resolveVariantRows>): VariantInput[] {
  return rows.map((r) => ({ size: r.size, color: r.color, ...(r.colorHex ? { colorHex: r.colorHex } : {}), sku: r.sku, barcode: r.barcode, stock: Number(r.stock) || 0, price: Number(r.price) || 0 }));
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
  embedded = false,
  reserved = [],
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
  /** Dentro de una ventana propia: sin la casilla "Tiene talles o colores" (siempre activo). */
  embedded?: boolean;
  /** Combinaciones que ya existen ("talle|color" en minúsculas): no se vuelven a crear. */
  reserved?: string[];
}) {
  const rows = useMemo(() => resolveVariantRows(state, baseSku, basePrice, reserved), [state, baseSku, basePrice, reserved]);
  const sizes = parseList(state.sizesText);
  const colors = parseList(state.colorsText);
  const priceMode = state.priceMode ?? "same";
  const [applyAll, setApplyAll] = useState("");
  const pg = usePagination(rows.length, `${state.sizesText}|${state.colorsText}`, "pesito-variantes-pagesize");

  function edit(key: string, field: "sku" | "barcode" | "stock" | "price", value: string) {
    onChange({ ...state, edits: { ...state.edits, [key]: { ...state.edits[key], [field]: value } } });
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3.5">
      {!embedded && (
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
      )}
      {locked && (
        <PlanLockNote plan="basico" className="mt-3">
          Los talles y colores están desde el Plan Básico.
        </PlanLockNote>
      )}

      {(state.enabled || embedded) && !locked && (
        <div className={cn("space-y-3", !embedded && "mt-4")}>
          <div className="space-y-4">
            <ChipPicker
              id="v-sizes"
              label="Talles"
              values={parseList(state.sizesText)}
              onChange={(list) => onChange({ ...state, sizesText: list.join(", ") })}
              quickGroups={[
                { title: "Ropa", options: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] },
                { title: "Calzado", options: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"] },
              ]}
              previous={sizeSuggestions}
              placeholder="Otro talle (ej: Único, 6 meses)"
            />
            <ChipPicker
              id="v-colors"
              label="Colores"
              values={parseList(state.colorsText)}
              onChange={(list) => onChange({ ...state, colorsText: list.join(", ") })}
              quickGroups={[{ title: "Comunes", options: ["Negro", "Blanco", "Gris", "Azul", "Rojo", "Verde", "Amarillo", "Rosa", "Beige", "Marrón"] }]}
              previous={colorSuggestions}
              placeholder="Otro color (ej: Azul marino)"
              swatches={{
                chosen: state.colorHex ?? {},
                onPick: (name, hex) => onChange({ ...state, colorHex: { ...state.colorHex, [name.toLowerCase()]: hex } }),
              }}
            />
          </div>
          {sizes.length > 0 && colors.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">Colores de cada talle</p>
              <p className="text-xs text-muted-foreground">Todos los colores están en todos los talles. Tocá un color para sacarlo de un talle que no lo tiene.</p>
              <div className="space-y-1.5">
                {sizes.map((size) => (
                  <div key={size} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-20 shrink-0 truncate text-sm font-semibold text-foreground" title={size}>{`Talle ${size}`}</span>
                    {colors.map((color) => {
                      const key = keyOf(size, color);
                      const off = state.excluded.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={!off}
                          onClick={() => onChange({ ...state, excluded: off ? state.excluded.filter((k) => k !== key) : [...state.excluded, key] })}
                          className={cn(chipBase, off ? "border-border bg-muted/40 text-muted-foreground line-through" : "border-primary bg-accent text-foreground")}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Tocá los talles y colores que tenga. Se arma una variante por cada combinación; podés usar sólo talles o sólo colores.
          </p>

          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{`${rows.length} variante${rows.length === 1 ? "" : "s"}`}</p>
              <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-medium text-foreground">Precio de venta</p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cómo se pone el precio">
                  {([
                    ["same", "El mismo para todas"],
                    ["each", "Uno por talle y color"],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={priceMode === mode}
                      onClick={() => onChange({ ...state, priceMode: mode })}
                      className={cn(chipBase, priceMode === mode ? "border-primary bg-accent text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {priceMode === "same" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={state.samePrice ?? basePrice}
                      onChange={(e) => onChange({ ...state, samePrice: e.target.value })}
                      aria-label="Precio para todas las variantes"
                      className="h-9 w-32"
                    />
                    <span className="text-xs text-muted-foreground">{`Se aplica a las ${rows.length} variantes.`}</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Cambiá el precio de cada una en la tabla. O poné uno para todas:</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={applyAll}
                      onChange={(e) => setApplyAll(e.target.value)}
                      aria-label="Precio a aplicar a todas"
                      className="h-8 w-28"
                    />
                    <button
                      type="button"
                      disabled={applyAll.trim() === ""}
                      onClick={() => {
                        const edits = { ...state.edits };
                        for (const r of rows) edits[r.key] = { ...edits[r.key], price: applyAll };
                        onChange({ ...state, edits });
                      }}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Aplicar a todas
                    </button>
                  </div>
                )}
              </div>
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
                          {priceMode === "each" ? (
                            <Input type="number" min={0} step="0.01" value={r.price} onChange={(e) => edit(r.key, "price", e.target.value)} aria-label={`Precio de ${r.size} ${r.color}`} className="h-8 w-24" />
                          ) : (
                            <span className="text-foreground">{r.price}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar total={rows.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} noun="variantes" />
              </div>
              <p className="text-xs text-muted-foreground">
                {embedded
                  ? "El SKU de cada variante se arma con el del producto: podés cambiarlo. Marca, costo, proveedor y los demás datos se copian del producto."
                  : "El SKU de cada variante se arma con el SKU base de arriba: podés cambiarlo. El costo y los demás datos son los mismos para todas."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const chipBase = "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors";

/**
 * Elegir talles o colores con botones: los más comunes se tocan para sumar o quitar, lo que ya usó el negocio aparece
 * aparte, y cualquier otro se escribe y se suma con Enter. Lo elegido se ve arriba y se saca con la ×.
 */
function ChipPicker({
  id,
  label,
  values,
  onChange,
  quickGroups,
  previous,
  placeholder,
  swatches,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (list: string[]) => void;
  quickGroups: { title: string; options: string[] }[];
  /** Los que ya usó el negocio en otros productos. */
  previous: string[];
  placeholder: string;
  /** Sólo en colores: punto con el color de referencia (tocarlo en un color elegido deja cambiarlo). */
  swatches?: { chosen: Record<string, string>; onPick: (name: string, hex: string) => void };
}) {
  const [draft, setDraft] = useState("");
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const has = (v: string) => values.some((x) => same(x, v));
  const toggle = (v: string) => onChange(has(v) ? values.filter((x) => !same(x, v)) : [...values, v]);
  const quickAll = quickGroups.flatMap((g) => g.options);
  const used = previous.filter((p) => !quickAll.some((q) => same(q, p)));

  function addDraft() {
    const items = parseList(draft);
    if (items.length === 0) return;
    const next = [...values];
    for (const item of items) if (!next.some((x) => same(x, item))) next.push(item);
    onChange(next);
    setDraft("");
  }

  const chip = (v: string) => (
    <button
      key={v}
      type="button"
      onClick={() => toggle(v)}
      aria-pressed={has(v)}
      className={cn(chipBase, has(v) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50")}
    >
      {swatches && <ColorDot name={v} chosen={swatches.chosen[v.toLowerCase()]} />}
      {v}
    </button>
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className={cn(chipBase, "border-primary bg-accent text-foreground")}>
              {swatches && <ColorPickerDot name={v} chosen={swatches.chosen[v.toLowerCase()]} onPick={(hex) => swatches.onPick(v, hex)} />}
              {v}
              <button type="button" onClick={() => toggle(v)} aria-label={`Quitar ${v}`} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {swatches && values.length > 0 && <p className="text-xs text-muted-foreground">Tocá el puntito de un color elegido para cambiar su color de referencia.</p>}
      {quickGroups.map((g) => (
        <div key={g.title} className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">{g.title}</span>
          {g.options.map(chip)}
        </div>
      ))}
      {used.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">Ya usaste</span>
          {used.map(chip)}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter suma el valor escrito (sin enviar el formulario del producto).
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder={placeholder}
          className="h-9 max-w-xs"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={draft.trim() === ""}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>
    </div>
  );
}

/** Punto con el color de referencia (el elegido o el que corresponde al nombre; gris claro si no se conoce). */
export function ColorDot({ name, chosen, className }: { name: string; chosen?: string | null; className?: string }) {
  const hex = colorHexFor(name, chosen);
  return (
    <span
      aria-hidden
      className={cn("inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-border", !hex && "bg-muted", className)}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

/** El mismo punto, pero tocándolo se elige el color de referencia con el selector del navegador. */
export function ColorPickerDot({ name, chosen, onPick }: { name: string; chosen?: string | null; onPick: (hex: string) => void }) {
  const hex = colorHexFor(name, chosen) ?? "#9ca3af";
  return (
    <label className="relative inline-flex h-4 w-4 shrink-0 cursor-pointer" title={`Color de referencia de ${name}`}>
      <span className="absolute inset-0 rounded-full border border-border" style={{ backgroundColor: hex }} />
      <input type="color" value={hex} onChange={(e) => onPick(e.target.value)} aria-label={`Color de referencia de ${name}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  );
}
