"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { colorHexFor, combinations, parseList, sortSizes, variantName, variantSku } from "@/lib/variants";
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
  const [advanced, setAdvanced] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const pg = usePagination(rows.length, `${state.sizesText}|${state.colorsText}`, "pesito-variantes-pagesize");
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const rowKeys = sizes.length > 0 ? sortSizes(sizes) : [""];
  const colKeys = colors.length > 0 ? colors : [""];
  const cellOf = (size: string, color: string) => byKey.get(keyOf(size, color));
  const samePriceValue = state.samePrice ?? basePrice;

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
        <div className={cn("space-y-4", !embedded && "mt-4")}>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">1 · ¿Qué talles y colores tiene?</p>
            <ChipPicker
              id="v-sizes"
              label="Talles"
              values={sizes}
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
              values={colors}
              onChange={(list) => onChange({ ...state, colorsText: list.join(", ") })}
              quickGroups={[{ title: "Comunes", options: ["Negro", "Blanco", "Gris", "Azul", "Rojo", "Verde", "Amarillo", "Rosa", "Beige", "Marrón"] }]}
              previous={colorSuggestions}
              placeholder="Otro color (ej: Azul marino)"
              swatches={{
                chosen: state.colorHex ?? {},
                onPick: (name, hex) => onChange({ ...state, colorHex: { ...state.colorHex, [name.toLowerCase()]: hex } }),
              }}
            />
            {sizes.length > 0 && colors.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowExcluded((v) => !v)}
                  aria-expanded={showExcluded || state.excluded.length > 0}
                  className="text-xs font-semibold text-accent-foreground hover:underline"
                >
                  {state.excluded.length > 0 ? `Algún talle no viene en todos los colores (${state.excluded.length} sacados)` : "¿Algún talle no viene en todos los colores?"}
                </button>
                {(showExcluded || state.excluded.length > 0) && (
                  <div className="mt-2 space-y-1.5 rounded-xl border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Tocá un color para sacarlo de un talle que no lo tiene.</p>
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
                )}
              </div>
            )}
          </div>

          {rows.length > 0 ? (
            <div className="space-y-4 border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">{`2 · Precio${showStock ? " y stock" : ""} · ${rows.length} variante${rows.length === 1 ? "" : "s"}`}</p>

              <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-foreground">$</span>
                Precio de venta
              </p>
              {priceMode === "same" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="v-price">{`El mismo precio para todos los ${sizes.length > 0 && colors.length > 0 ? "talles y colores" : colors.length > 0 ? "colores" : "talles"}`}</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-40">
                      <Input id="v-price" type="number" min={0} step="0.01" value={samePriceValue} onChange={(e) => onChange({ ...state, samePrice: e.target.value })} placeholder="Ej: 8900" />
                    </div>
                    <button type="button" onClick={() => onChange({ ...state, priceMode: "each" })} className="text-xs font-semibold text-accent-foreground hover:underline">
                      Poner un precio distinto a cada variante
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Un precio para cada talle y color</p>
                    <button type="button" onClick={() => onChange({ ...state, priceMode: "same" })} className="text-xs font-semibold text-accent-foreground hover:underline">
                      Volver a un solo precio
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-32">
                      <Input type="number" min={0} step="0.01" value={applyAll} onChange={(e) => setApplyAll(e.target.value)} placeholder="Para todas" aria-label="Precio a aplicar a todas" className="h-8" />
                    </div>
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
                  <VariantMatrix rowKeys={rowKeys} colKeys={colKeys} colors={state.colorHex} cellOf={cellOf} field="price" onEdit={edit} />
                </div>
              )}
              </div>

              {showStock && (
                <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">u</span>
                    Stock
                    <span className="text-xs font-normal text-muted-foreground">cuántas unidades tenés de cada una</span>
                  </p>
                  <VariantMatrix rowKeys={rowKeys} colKeys={colKeys} colors={state.colorHex} cellOf={cellOf} field="stock" onEdit={edit} />
                </div>
              )}

              <div className="rounded-xl border border-dashed border-border">
                <button
                  type="button"
                  onClick={() => setAdvanced((v) => !v)}
                  aria-expanded={advanced}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-muted-foreground"
                >
                  <span><b className="font-semibold text-foreground">SKU y códigos de barras</b>{" · opcional, se arman solos"}</span>
                  <span className="flex items-center gap-1 font-semibold text-accent-foreground">
                    Personalizar
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advanced && "rotate-180")} />
                  </span>
                </button>
                {advanced && (
                  <div className="space-y-2 border-t border-dashed border-border p-2.5">
                    <div className="overflow-x-auto rounded-xl border border-border bg-card">
                      <table className="w-full table-fixed text-left text-xs">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="w-[22%] px-2 py-2">Variante</th>
                            <th className="px-2 py-2">SKU</th>
                            <th className="w-[30%] px-2 py-2">Código de barras</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(pg.start, pg.end).map((r) => (
                            <tr key={r.key} className="border-t border-border align-middle">
                              <td className="truncate px-2 py-1.5 font-medium text-foreground" title={variantName(baseName || "Producto", r.size, r.color)}>
                                {[r.size, r.color].filter(Boolean).join(" · ")}
                              </td>
                              <td className="px-2 py-1.5">
                                <Input value={r.sku} onChange={(e) => edit(r.key, "sku", e.target.value)} maxLength={60} aria-label={`SKU de ${r.size} ${r.color}`} className="h-8" />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input value={r.barcode} onChange={(e) => edit(r.key, "barcode", e.target.value)} aria-label={`Código de barras de ${r.size} ${r.color}`} className="h-8" placeholder="Opcional" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <PaginationBar total={rows.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} noun="variantes" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {embedded
                        ? "El SKU de cada variante se arma con el del producto. Marca, costo, proveedor y los demás datos se copian del producto."
                        : "El SKU de cada variante se arma con el SKU base de arriba. El costo y los demás datos son los mismos para todas."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Tocá los talles y colores que tenga: se arma una variante por cada combinación. Podés usar sólo talles o sólo colores.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Grilla talle × color (o una sola fila/columna) con un número editable en cada variante: stock o precio. */
function VariantMatrix({
  rowKeys,
  colKeys,
  colors,
  cellOf,
  field,
  onEdit,
}: {
  rowKeys: string[];
  colKeys: string[];
  colors?: Record<string, string>;
  cellOf: (size: string, color: string) => { key: string; stock: string; price: string } | undefined;
  field: "stock" | "price";
  onEdit: (key: string, field: "stock" | "price", value: string) => void;
}) {
  const hasColors = colKeys.some((c) => c !== "");
  const hasSizes = rowKeys.some((r) => r !== "");
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs">
        {hasColors && (
          <thead>
            <tr>
              {hasSizes && <th />}
              {colKeys.map((c) => (
                <th key={c} className="px-1 text-center font-semibold text-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <ColorDot name={c} chosen={colors?.[c.toLowerCase()]} />
                    {c}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rowKeys.map((s) => (
            <tr key={s || "-"}>
              {hasSizes && <th className="pr-1.5 text-right font-bold text-foreground">{s}</th>}
              {colKeys.map((c) => {
                const cell = cellOf(s, c);
                if (!cell) return <td key={c || "-"} className="text-center text-muted-foreground">—</td>;
                return (
                  <td key={c || "-"}>
                    <div className="relative w-28">
                      {field === "price" && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">$</span>}
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={cell[field]}
                        onChange={(e) => onEdit(cell.key, field, e.target.value)}
                        aria-label={`${field === "stock" ? "Stock" : "Precio"} de ${[s, c].filter(Boolean).join(" ")}`}
                        className={cn("h-8", field === "price" ? "pl-6 pr-2 text-right" : "pl-2 pr-7 text-right")}
                      />
                      {field === "stock" && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">u</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
  const [groupIdx, setGroupIdx] = useState(0);
  const [showUsed, setShowUsed] = useState(false);
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
      {swatches && values.length > 0 && <p className="text-xs text-muted-foreground">Tocá el puntito de un color elegido para cambiarlo.</p>}
      {quickGroups.length > 1 && (
        <div role="tablist" aria-label={`Tipos de ${label.toLowerCase()}`} className="inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          {quickGroups.map((g, i) => (
            <button
              key={g.title}
              type="button"
              role="tab"
              aria-selected={groupIdx === i}
              onClick={() => setGroupIdx(i)}
              className={cn("rounded-md px-2.5 py-0.5 text-xs font-semibold", groupIdx === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {g.title}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">{(quickGroups[Math.min(groupIdx, quickGroups.length - 1)]?.options ?? []).map(chip)}</div>
      {used.length > 0 && (
        <div className="space-y-1.5">
          <button type="button" onClick={() => setShowUsed((v) => !v)} aria-expanded={showUsed} className="text-xs font-semibold text-accent-foreground hover:underline">
            {showUsed ? "Ocultar los que ya usaste" : `Ver los que ya usaste (${used.length})`}
          </button>
          {showUsed && <div className="flex flex-wrap items-center gap-1.5">{used.map(chip)}</div>}
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
      className={cn("inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-foreground/30", !hex && "bg-muted", className)}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

/** El mismo punto, pero tocándolo se elige el color de referencia con el selector del navegador. */
export function ColorPickerDot({ name, chosen, onPick }: { name: string; chosen?: string | null; onPick: (hex: string) => void }) {
  const hex = colorHexFor(name, chosen) ?? "#9ca3af";
  return (
    <label className="relative inline-flex h-4 w-4 shrink-0 cursor-pointer" title={`Color de referencia de ${name}`}>
      <span className="absolute inset-0 rounded-full border border-foreground/30" style={{ backgroundColor: hex }} />
      <input type="color" value={hex} onChange={(e) => onPick(e.target.value)} aria-label={`Color de referencia de ${name}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  );
}
