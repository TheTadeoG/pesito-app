"use client";

import { ChevronDown, ImageIcon, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { sortSizes } from "@/lib/variants";
import type { Product } from "@/lib/types";

/** Nombre del producto sin el " · talle · color" que lleva cada variante. */
export function baseNameOf(p: Product): string {
  const parts = [p.variant_size, p.variant_color].filter(Boolean) as string[];
  const suffix = parts.length ? ` · ${parts.join(" · ")}` : "";
  return suffix && p.name.endsWith(suffix) ? p.name.slice(0, -suffix.length) : p.name;
}

function unique(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

export function variantTagLabel(members: Product[]): string {
  const hasSize = members.some((m) => m.variant_size);
  const hasColor = members.some((m) => m.variant_color);
  const what = hasSize && hasColor ? "talles y colores" : hasColor ? "colores" : "talles";
  return `Tiene ${what} · ${members.length}`;
}

/**
 * Un producto con variantes ocupa una sola fila con la etiqueta "Tiene talles";
 * al tocarla se despliega el stock por talle y color. Cada variante sigue siendo un producto
 * con su SKU, stock y precio.
 */
export function VariantGroupRows({
  members,
  colSpan,
  onEdit,
  onAdjust,
  onEditGroup,
}: {
  members: Product[];
  colSpan: number;
  onEdit: (p: Product) => void;
  onAdjust: (p: Product) => void;
  /** Abre la ventana del producto, en la solapa que se pida. */
  onEditGroup: (tab: "datos" | "variantes") => void;
}) {
  const [open, setOpen] = useState(false);
  const first = members[0];
  const total = members.reduce((sum, m) => sum + m.stock, 0);
  const prices = members.map((m) => m.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceText =
    minPrice === maxPrice ? formatCurrency(minPrice) : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`;
  const sizes = sortSizes(unique(members.map((m) => m.variant_size)));
  const colors = unique(members.map((m) => m.variant_color));
  const allInactive = members.every((m) => !m.active);
  const low = members.filter((m) => m.active && m.stock <= m.min_stock).length;
  const unit = first.unit ?? "";
  const image = members.find((m) => m.image_url)?.image_url ?? null;
  const cell = (size: string | null, color: string | null) =>
    members.find(
      (m) =>
        (m.variant_size ?? "").trim().toLowerCase() === (size ?? "").trim().toLowerCase() &&
        (m.variant_color ?? "").trim().toLowerCase() === (color ?? "").trim().toLowerCase(),
    );
  // Sólo talles, sólo colores o ninguno de los dos: la grilla tiene una fila o una columna "única".
  const rowKeys: (string | null)[] = sizes.length ? sizes : [null];
  const colKeys: (string | null)[] = colors.length ? colors : [null];

  return (
    <Fragment>
      <tr className={cn("align-middle hover:bg-muted/30", open && "bg-success-bg/40")}>
        <td className={cn("px-4 py-2.5", allInactive && "opacity-60")}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-muted-foreground">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate font-medium text-foreground">{baseNameOf(first)}</p>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground hover:brightness-95"
              >
                {variantTagLabel(members)}
                <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
              </button>
            </div>
          </div>
        </td>
        <td colSpan={Math.max(1, colSpan - 2)} className={cn("px-3 py-2.5 text-muted-foreground", allInactive && "opacity-60")}>
          <span className="font-semibold text-foreground">{`Stock total ${total}${unit}`}</span>
          <span>{` · ${priceText}`}</span>
          {low > 0 && (
            <span className="ml-2 font-medium text-danger">{`${low} ${low === 1 ? "variante con stock bajo" : "variantes con stock bajo"}`}</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? "Cerrar" : "Ver variantes"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onEditGroup("datos")}
              aria-label="Editar producto"
              title="Editar producto"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={colSpan} className="bg-success-bg/40 px-4 pb-4 pt-1 sm:pl-16">
            <p className="mb-2 text-sm font-semibold text-foreground">
              {colors.length && sizes.length ? "Stock por talle y color" : colors.length ? "Stock por color" : "Stock por talle"}
            </p>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-1.5 text-sm">
                <thead>
                  <tr>
                    <th />
                    {colKeys.map((c) => (
                      <th key={c ?? "-"} className="px-2 text-center text-xs font-semibold text-foreground">
                        {c ?? ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowKeys.map((s) => (
                    <tr key={s ?? "-"}>
                      <td className="pr-2 text-right text-xs font-bold text-foreground">{s ?? ""}</td>
                      {colKeys.map((c) => {
                        const v = cell(s, c);
                        if (!v) return <td key={c ?? "-"} className="min-w-[96px] rounded-lg border border-dashed border-border text-center text-muted-foreground">—</td>;
                        const zero = v.stock <= 0;
                        const lowStock = !zero && v.stock <= v.min_stock;
                        return (
                          <td
                            key={c ?? "-"}
                            className={cn(
                              "min-w-[96px] rounded-lg border px-2 py-1.5 text-center",
                              zero
                                ? "border-danger/40 bg-danger-bg"
                                : lowStock
                                  ? "border-warning/40 bg-warning-bg"
                                  : "border-border bg-card",
                              !v.active && "opacity-60",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => onEdit(v)}
                              className="block w-full"
                              title={`Editar ${v.name}`}
                            >
                              <span className={cn("block text-base font-bold", zero ? "text-danger" : "text-foreground")}>
                                {`${v.stock}${v.unit ?? ""}`}
                              </span>
                              <span className="block text-[10.5px] leading-tight text-muted-foreground">{v.sku}</span>
                              <span className="block text-[10.5px] leading-tight text-muted-foreground">{formatCurrency(v.price)}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onAdjust(v)}
                              className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-accent-foreground hover:underline"
                            >
                              <SlidersHorizontal className="h-3 w-3" />
                              Ajustar
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => onEditGroup("variantes")}>
                <Plus className="h-4 w-4" />
                Agregar talles o colores
              </Button>
              <p className="text-xs text-muted-foreground">
                Tocá una celda para editar esa variante, o &quot;Ajustar&quot; para corregir su stock.
              </p>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
