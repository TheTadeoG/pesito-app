"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PackagePlus, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";
import { getPeriodRange, type ReportPeriod } from "@/lib/report-periods";
import type { Product } from "@/lib/types";
import { PaginationBar, pageBounds, usePageSize } from "@/components/dashboard/pagination-bar";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";

const MOVEMENTS_PAGE_SIZE = 25;
// El "reference" de una venta es su id (un uuid): no le dice nada a nadie.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MovementRow {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  reference: string | null;
  created_at: string;
  product_name: string;
  product_sku: string | null;
  product_barcode: string | null;
}

type MovementPeriod = "all" | ReportPeriod;

const periodOptions: { value: MovementPeriod; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Este mes" },
];

const movementTypes = ["venta", "compra", "ajuste", "transferencia", "apertura"] as const;
const movementTypeLabels: Record<string, string> = {
  venta: "Venta",
  compra: "Compra",
  ajuste: "Ajuste",
  transferencia: "Transferencia",
  apertura: "Apertura",
};

/**
 * Movimientos de stock: el historial (ventas, compras, ajustes, transferencias) y
 * el alta de un movimiento manual. El inventario en sí está en la lista de Productos.
 */
export function MovementsTab({
  products,
  movements,
  focusedProduct,
}: {
  products: Product[];
  movements: MovementRow[];
  // Viene de "Ver movimientos" en la tabla de productos.
  focusedProduct: { id: string; name: string } | null;
}) {
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [period, setPeriod] = useState<MovementPeriod>(focusedProduct ? "all" : "30d");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [movementQuery, setMovementQuery] = useState("");
  const [moveSize, setMoveSize] = usePageSize("pesito-moves-page-size", MOVEMENTS_PAGE_SIZE);
  const [movePage, setMovePage] = useState(0);

  const pickerResults = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase() === q ||
        p.barcode?.toLowerCase() === q
    );
  }, [products, pickerQuery]);

  function closePicker() {
    setPickerOpen(false);
    setPickerQuery("");
  }

  const filteredMovements = useMemo(() => {
    const start = period === "all" ? null : getPeriodRange(period).start;
    const q = movementQuery.trim().toLowerCase();

    return movements.filter((m) => {
      if (focusedProduct && m.product_id !== focusedProduct.id) return false;
      if (start && new Date(m.created_at) < start) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      if (q) {
        const matches =
          m.product_name.toLowerCase().includes(q) ||
          m.product_sku?.toLowerCase() === q ||
          m.product_barcode?.toLowerCase() === q;
        if (!matches) return false;
      }
      return true;
    });
  }, [movements, focusedProduct, period, typeFilter, movementQuery]);

  const moveKey = `${period}|${typeFilter ?? ""}|${movementQuery}|${focusedProduct?.id ?? ""}`;
  // Al cambiar el período, el tipo o la búsqueda se vuelve a la primera página.
  const [moveListKey, setMoveListKey] = useState(moveKey);
  if (moveListKey !== moveKey) {
    setMoveListKey(moveKey);
    setMovePage(0);
  }
  const moveBounds = pageBounds(filteredMovements.length, movePage, moveSize);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
          <PackagePlus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

        <Card>
          <CardHeader>
            <div className="space-y-3">
              {focusedProduct && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Mostrando sólo</span>
                  <Link
                    href="/productos?tab=movimientos"
                    className="inline-flex items-center gap-1 rounded-full border border-primary bg-accent px-2.5 py-1 text-xs font-medium text-foreground"
                    title="Ver todos los productos"
                  >
                    {focusedProduct.name}
                    <X className="h-3 w-3" />
                  </Link>
                </div>
              )}
              <div className="inline-flex flex-wrap rounded-xl border border-border bg-muted/50 p-1">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      period === option.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={movementQuery}
                    onChange={(e) => setMovementQuery(e.target.value)}
                    placeholder="Buscar por producto, SKU o código de barras…"
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTypeFilter(null)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      typeFilter === null
                        ? "border-primary bg-accent text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Todos
                  </button>
                  {movementTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTypeFilter(type)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        typeFilter === type
                          ? "border-primary bg-accent text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {movementTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredMovements.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                {movements.length === 0
                  ? "Todavía no hay movimientos de stock."
                  : "No encontramos movimientos con esos filtros."}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {filteredMovements.slice(moveBounds.start, moveBounds.end).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(m.created_at)}
                        {m.product_sku ? ` · SKU ${m.product_sku}` : ""}
                        {m.reference && !UUID_RE.test(m.reference) ? ` · ${m.reference}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{movementTypeLabels[m.type] ?? m.type}</Badge>
                      <span
                        className={`text-sm font-semibold ${m.quantity < 0 ? "text-danger" : "text-success"}`}
                      >
                        {m.quantity > 0 ? "+" : ""}
                        {m.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <PaginationBar
            total={filteredMovements.length}
            page={moveBounds.safePage}
            pageSize={moveSize}
            noun="movimientos"
            onPageChange={setMovePage}
            onPageSizeChange={(n) => {
              setMoveSize(n);
              setMovePage(0);
            }}
          />
        </Card>

      <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />

      <Dialog
        open={pickerOpen}
        onClose={closePicker}
        title="Nuevo movimiento manual"
        description="Elegí el producto para sumar, restar o ajustar su stock."
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Buscar producto por nombre, SKU o código de barras…"
              className="pl-10"
            />
          </div>
          <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {pickerResults.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No encontramos productos con esa búsqueda.
              </p>
            ) : (
              pickerResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setAdjusting(product);
                    closePicker();
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {product.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Stock: {product.stock}
                    {product.unit}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
