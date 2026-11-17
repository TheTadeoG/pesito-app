"use client";

import { ChevronDown, History, ImageIcon, MoreVertical, Pencil, Plus, Receipt, SlidersHorizontal, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { sortSizes } from "@/lib/variants";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ColorDot } from "@/app/(dashboard)/productos/variants-section";
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

/** Las variantes en orden natural: por talle (XS, S, M, L…) y después por color. */
function sortMembers(members: Product[]): Product[] {
  const order = sortSizes(unique(members.map((m) => m.variant_size)));
  return [...members].sort(
    (a, b) =>
      order.indexOf((a.variant_size ?? "").trim()) - order.indexOf((b.variant_size ?? "").trim()) ||
      (a.variant_color ?? "").localeCompare(b.variant_color ?? "", "es"),
  );
}

/** Cuántas variantes se muestran de entrada; el resto, con "Ver todas". */
const INITIAL_VISIBLE = 8;

/**
 * Un producto con variantes: una fila con el producto (y la etiqueta "Tiene talles", que cierra o abre la lista) y debajo
 * una fila por variante, con las mismas columnas de la tabla: SKU, costo, precio, stock y mínimo de cada una.
 */
export function VariantGroupRows({
  members,
  show,
  supplierName,
  activeOf,
  busyId,
  onAdjust,
  onMovements,
  onHistory,
  onToggleActive,
  onDelete,
  onToggleGroup,
  onDeleteGroup,
  onEditGroup,
}: {
  members: Product[];
  /** Si la columna está visible en la tabla ("brand", "supplier", "sku", "barcode", "cost", "price", "stock", "minStock"). */
  show: (column: string) => boolean;
  supplierName?: string;
  /** Si la variante está activa (con el cambio que todavía no volvió del servidor). */
  activeOf: (p: Product) => boolean;
  busyId: string | null;
  onAdjust: (p: Product) => void;
  onMovements: (p: Product) => void;
  onHistory: (p: Product) => void;
  onToggleActive: (p: Product) => void;
  onDelete: (p: Product) => void;
  /** Activa o desactiva todas las variantes a la vez. */
  onToggleGroup: (members: Product[], next: boolean) => void;
  /** Borra el producto con todas sus variantes. */
  onDeleteGroup: (members: Product[]) => void;
  /** Abre la ventana del producto, en la solapa que se pida. */
  onEditGroup: (tab: "datos" | "variantes") => void;
}) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const sorted = sortMembers(members);
  const first = sorted[0];
  const shown = all ? sorted : sorted.slice(0, INITIAL_VISIBLE);
  const total = members.reduce((sum, m) => sum + m.stock, 0);
  const prices = members.map((m) => m.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceText = minPrice === maxPrice ? formatCurrency(minPrice) : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`;
  const allInactive = members.every((m) => !activeOf(m));
  const sameCost = members.every((m) => (m.cost ?? 0) === (first.cost ?? 0));
  const minStocks = members.map((m) => m.min_stock);
  const sameMin = minStocks.every((v) => v === minStocks[0]);
  const outCount = members.filter((m) => activeOf(m) && m.stock <= 0).length;
  const lowCount = members.filter((m) => activeOf(m) && m.stock > 0 && m.stock <= m.min_stock).length;
  const unit = first.unit ?? "";
  const image = members.find((m) => m.image_url)?.image_url ?? null;
  const dim = allInactive && "opacity-60";

  return (
    <Fragment>
      <tr className="align-middle hover:bg-muted/30">
        <td className={cn("px-4 py-2.5", dim)}>
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
        {show("brand") && <td className={cn("px-3 py-2.5 text-muted-foreground", dim)}>{first.brand || "—"}</td>}
        {show("supplier") && <td className={cn("px-3 py-2.5 text-muted-foreground", dim)}>{supplierName || "—"}</td>}
        {show("sku") && <td className={cn("px-3 py-2.5 text-muted-foreground", dim)}>{`${members.length} SKU`}</td>}
        {show("barcode") && <td className={cn("px-3 py-2.5 text-muted-foreground", dim)}>—</td>}
        {show("cost") && (
          <td className={cn("px-3 py-2.5 text-right text-muted-foreground", dim)}>{sameCost ? (first.cost ? formatCurrency(first.cost) : "—") : "Varios"}</td>
        )}
        {show("price") && <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-semibold text-foreground", dim)}>{priceText}</td>}
        {show("stock") && (
          <td className={cn("px-3 py-2.5 text-right", dim)}>
            <span className="font-medium text-foreground">{`${total}${unit}`}</span>
            {(outCount > 0 || lowCount > 0) && (
              <span className="block whitespace-nowrap text-[11px] font-medium leading-tight text-danger">
                {[outCount > 0 && `${outCount} sin stock`, lowCount > 0 && `${lowCount} con stock bajo`].filter(Boolean).join(" · ")}
              </span>
            )}
          </td>
        )}
        {show("minStock") && (
          <td className={cn("px-3 py-2.5 text-right text-muted-foreground", dim)}>{sameMin ? `${minStocks[0]}${unit}` : "Varios"}</td>
        )}
        <td className="px-4 py-2.5">
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="outline" size="icon" onClick={() => onEditGroup("datos")} aria-label="Editar" title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <DropdownMenu
              trigger={
                <Button variant="outline" size="icon" aria-label="Más acciones" title="Más acciones">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            >
              <DropdownMenuItem onClick={() => onEditGroup("variantes")}>
                <Plus className="h-4 w-4" />
                Agregar talles o colores
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleGroup(members, allInactive)} disabled={members.some((m) => busyId === m.id)}>
                {allInactive ? "Activar todas las variantes" : "Desactivar todas las variantes"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteGroup(members)} disabled={members.some((m) => busyId === m.id)} danger>
                <Trash2 className="h-4 w-4" />
                Borrar con todas sus variantes
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </td>
      </tr>
      {open &&
        shown.map((m) => {
          const isActive = activeOf(m);
          const lowStock = isActive && m.stock <= m.min_stock;
          const faded = !isActive && "opacity-60";
          return (
            <tr key={m.id} className="align-middle bg-muted/50 hover:bg-muted/70">
              <td className={cn("border-l-[3px] border-l-primary/60 py-2 pl-[3.75rem] pr-4", faded)}>
                <div className="flex items-center gap-2 text-sm">
                  {m.variant_color && <ColorDot name={m.variant_color} chosen={m.variant_color_hex} />}
                  <span className="font-medium text-foreground">{[m.variant_size, m.variant_color].filter(Boolean).join(" · ") || m.name}</span>
                  {!isActive && <Badge>Inactivo</Badge>}
                </div>
              </td>
              {show("brand") && <td />}
              {show("supplier") && <td />}
              {show("sku") && <td className={cn("whitespace-nowrap px-3 py-2 text-muted-foreground", faded)}>{m.sku || "—"}</td>}
              {show("barcode") && <td className={cn("px-3 py-2 text-muted-foreground", faded)}>{m.barcode || "—"}</td>}
              {show("cost") && <td className={cn("px-3 py-2 text-right text-muted-foreground", faded)}>{m.cost ? formatCurrency(m.cost) : "—"}</td>}
              {show("price") && <td className={cn("px-3 py-2 text-right font-semibold text-foreground", faded)}>{formatCurrency(m.price)}</td>}
              {show("stock") && (
                <td className={cn("px-3 py-2 text-right", faded)}>
                  <span className={cn("font-medium", lowStock ? "text-danger" : "text-foreground")}>{`${m.stock}${m.unit ?? ""}`}</span>
                </td>
              )}
              {show("minStock") && <td className={cn("px-3 py-2 text-right text-muted-foreground", faded)}>{`${m.min_stock}${m.unit ?? ""}`}</td>}
              <td className="px-4 py-2">
                <div className="flex items-center justify-end gap-1.5">
                  <Button variant="outline" size="icon" onClick={() => onEditGroup("variantes")} aria-label="Editar las variantes" title="Editar las variantes">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DropdownMenu
                    trigger={
                      <Button variant="outline" size="icon" aria-label={`Más acciones de ${m.name}`} title="Más acciones">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    }
                  >
                    <DropdownMenuItem onClick={() => onAdjust(m)}>
                      <SlidersHorizontal className="h-4 w-4" />
                      Ajustar stock
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onMovements(m)}>
                      <History className="h-4 w-4" />
                      Ver movimientos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onHistory(m)}>
                      <Receipt className="h-4 w-4" />
                      Historial de precios y costos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleActive(m)} disabled={busyId === m.id}>
                      {isActive ? "Desactivar" : "Activar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(m)} disabled={busyId === m.id} danger>
                      <Trash2 className="h-4 w-4" />
                      Borrar
                    </DropdownMenuItem>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          );
        })}
      {open && sorted.length > INITIAL_VISIBLE && (
        <tr className="bg-muted/50">
          <td colSpan={20} className="border-l-[3px] border-l-primary/60 py-2 pl-[3.75rem] pr-4">
            <button type="button" onClick={() => setAll((v) => !v)} className="text-xs font-semibold text-accent-foreground hover:underline">
              {all ? "Ver menos" : `Ver las ${sorted.length} variantes`}
            </button>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
