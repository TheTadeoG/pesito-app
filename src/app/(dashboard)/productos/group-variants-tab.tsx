"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { cn, formatCurrency } from "@/lib/utils";
import { baseSkuOf, sortSizes } from "@/lib/variants";
import { VariantsSection, type VariantsState } from "@/app/(dashboard)/productos/variants-section";
import { baseNameOf } from "@/app/(dashboard)/productos/variant-group-rows";
import type { Product } from "@/lib/types";

export type RowEdits = Record<string, { sku?: string; barcode?: string; price?: string }>;

/** Solapa "Talles y colores" del producto: edita SKU, código y precio de cada variante, y suma talles o colores nuevos. */
export function GroupVariantsTab({
  members,
  edits,
  onEdit,
  onEditMany,
  newVariants,
  onNewVariantsChange,
  locked,
  sizeSuggestions,
  colorSuggestions,
}: {
  members: Product[];
  edits: RowEdits;
  onEdit: (id: string, field: "sku" | "barcode" | "price", value: string) => void;
  onEditMany: (field: "price", value: string) => void;
  newVariants: VariantsState;
  onNewVariantsChange: (next: VariantsState) => void;
  locked: boolean;
  sizeSuggestions: string[];
  colorSuggestions: string[];
}) {
  const [bulk, setBulk] = useState("");
  const sorted = useMemo(() => {
    const order = sortSizes(Array.from(new Set(members.map((m) => m.variant_size ?? ""))));
    return [...members].sort(
      (a, b) =>
        order.indexOf(a.variant_size ?? "") - order.indexOf(b.variant_size ?? "") ||
        (a.variant_color ?? "").localeCompare(b.variant_color ?? "", "es"),
    );
  }, [members]);
  const pg = usePagination(sorted.length, String(members.length), "pesito-grupo-variantes-pagesize");
  const first = members[0];
  const reserved = useMemo(
    () => members.map((m) => `${(m.variant_size ?? "").toLowerCase()}|${(m.variant_color ?? "").toLowerCase()}`),
    [members],
  );
  const baseSku = baseSkuOf(first.sku, first.variant_size ?? "", first.variant_color ?? "");
  const bulkValid = bulk.trim() !== "" && Number.isFinite(Number(bulk.replace(",", "."))) && Number(bulk.replace(",", ".")) >= 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3.5">
        <Label htmlFor="g-bulk-price">Precio de venta de todas las variantes</Label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Input
              id="g-bulk-price"
              type="number"
              min={0}
              step="0.01"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder="Ej: 4800"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!bulkValid}
            onClick={() => {
              onEditMany("price", bulk.replace(",", "."));
              setBulk("");
            }}
          >
            {`Aplicar a las ${members.length}`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Queda cargado en la tabla de abajo; se guarda con “Guardar cambios”. Podés retocar el precio de una sola variante.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{`${members.length} variante${members.length === 1 ? "" : "s"}`}</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-2.5 py-2">Variante</th>
                <th className="px-2.5 py-2">SKU</th>
                <th className="px-2.5 py-2">Código de barras</th>
                <th className="px-2.5 py-2">Precio</th>
                <th className="px-2.5 py-2 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(pg.start, pg.end).map((m) => {
                const e = edits[m.id] ?? {};
                const label = [m.variant_size, m.variant_color].filter(Boolean).join(" · ") || m.name;
                return (
                  <tr key={m.id} className="border-t border-border align-middle">
                    <td className="max-w-[10rem] truncate px-2.5 py-1.5 font-medium text-foreground" title={m.name}>
                      {label}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <Input value={e.sku ?? m.sku} onChange={(ev) => onEdit(m.id, "sku", ev.target.value)} maxLength={60} aria-label={`SKU de ${label}`} className="h-8 min-w-[9rem]" />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <Input value={e.barcode ?? m.barcode ?? ""} onChange={(ev) => onEdit(m.id, "barcode", ev.target.value)} aria-label={`Código de barras de ${label}`} className="h-8 min-w-[7rem]" placeholder="Opcional" />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <Input type="number" min={0} step="0.01" value={e.price ?? String(m.price)} onChange={(ev) => onEdit(m.id, "price", ev.target.value)} aria-label={`Precio de ${label}`} className="h-8 w-24" />
                    </td>
                    <td className={cn("px-2.5 py-1.5 text-right font-medium", m.stock <= m.min_stock ? "text-danger" : "text-foreground")}>
                      {`${m.stock}${m.unit}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationBar total={sorted.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} noun="variantes" />
        </div>
        <p className="text-xs text-muted-foreground">
          {`El stock no se cambia acá: usá “Ajustar” en la lista de productos. Precio actual: ${formatCurrency(first.price)}${members.some((m) => m.price !== first.price) ? " (hay precios distintos)" : ""}.`}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Sumar talles o colores nuevos</p>
        {locked ? (
          <PlanLockNote plan="basico">Los talles y colores están desde el Plan Básico.</PlanLockNote>
        ) : (
          <VariantsSection
            embedded
            state={{ ...newVariants, enabled: true }}
            onChange={onNewVariantsChange}
            locked={false}
            baseName={baseNameOf(first)}
            baseSku={baseSku}
            basePrice={String(first.price)}
            sizeSuggestions={sizeSuggestions}
            colorSuggestions={colorSuggestions}
            showStock
            reserved={reserved}
          />
        )}
      </div>
    </div>
  );
}
