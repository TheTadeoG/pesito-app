"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowDownToLine, Download, PackageOpen, PackagePlus, Search, ShoppingCart, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { dayKey } from "@/lib/supplier-debt";
import { getPeriodRange, type ReportPeriod } from "@/lib/report-periods";
import type { Product } from "@/lib/types";
import { PaginationBar, pageBounds, usePageSize } from "@/components/dashboard/pagination-bar";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";

const MOVEMENTS_PAGE_SIZE = 25;
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
  /** Quién lo hizo (sólo se manda a quienes administran el negocio). */
  user_label?: string | null;
  unit?: string;
  /** Stock actual del producto en esta sucursal. */
  stock_now?: number | null;
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

// Cada tipo con su ícono y color (tintes que funcionan en modo claro y oscuro).
const TYPE_META: Record<string, { icon: LucideIcon; tone: string; text: string }> = {
  venta: { icon: ShoppingCart, tone: "bg-danger-bg text-danger", text: "Salió por una venta" },
  compra: { icon: ArrowDownToLine, tone: "bg-success-bg text-success", text: "Entró por una compra" },
  ajuste: { icon: SlidersHorizontal, tone: "bg-warning-bg text-warning", text: "Ajuste manual o inventario" },
  transferencia: { icon: ArrowLeftRight, tone: "bg-accent text-accent-foreground", text: "Pasó entre sucursales" },
  apertura: { icon: PackageOpen, tone: "bg-muted text-muted-foreground", text: "Stock inicial" },
};

const fmtQty = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

/** "Anulación de venta eacc72ab-…" -> "Anulación de venta": los ids internos no le dicen nada a nadie. */
function cleanReference(ref: string | null): string | null {
  if (!ref) return null;
  const text = ref.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "").replace(/\s+/g, " ").trim();
  return text || null;
}

async function downloadMovementsExcel(rows: MovementRow[]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const head = ["Fecha", "Producto", "SKU", "Tipo", "Cantidad", "Detalle", "Hecho por"].map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#e5e7eb" }));
  const body = rows.map((m) => [
    { value: new Date(m.created_at), format: "dd/mm/yyyy hh:mm" },
    { value: m.product_name },
    { value: m.product_sku ?? "" },
    { value: movementTypeLabels[m.type] ?? m.type },
    { value: m.quantity, format: Number.isInteger(m.quantity) ? "0" : "0.00" },
    { value: cleanReference(m.reference) ?? "" },
    { value: m.user_label ?? "" },
  ]);
  await writeXlsxFile([head, ...body], {
    columns: [{ width: 18 }, { width: 38 }, { width: 16 }, { width: 14 }, { width: 11 }, { width: 40 }, { width: 22 }],
    stickyRowsCount: 1,
  }).toFile("pesito-movimientos-de-stock.xlsx");
}

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
  const [userFilter, setUserFilter] = useState("");
  const [detail, setDetail] = useState<MovementRow | null>(null);
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
      if (userFilter && m.user_label !== userFilter) return false;
      if (q) {
        const matches =
          m.product_name.toLowerCase().includes(q) ||
          m.product_sku?.toLowerCase() === q ||
          m.product_barcode?.toLowerCase() === q;
        if (!matches) return false;
      }
      return true;
    });
  }, [movements, focusedProduct, period, typeFilter, movementQuery, userFilter]);

  const moveKey = `${period}|${typeFilter ?? ""}|${movementQuery}|${userFilter}|${focusedProduct?.id ?? ""}`;
  // Al cambiar el período, el tipo o la búsqueda se vuelve a la primera página.
  const [moveListKey, setMoveListKey] = useState(moveKey);
  if (moveListKey !== moveKey) {
    setMoveListKey(moveKey);
    setMovePage(0);
  }
  const moveBounds = pageBounds(filteredMovements.length, movePage, moveSize);

  const people = useMemo(() => Array.from(new Set(movements.map((m) => m.user_label).filter((l): l is string => Boolean(l)))).sort(), [movements]);
  const totals = useMemo(() => {
    let inUnits = 0;
    let outUnits = 0;
    for (const m of filteredMovements) {
      if (m.quantity > 0) inUnits += m.quantity;
      else outUnits += -m.quantity;
    }
    return { inUnits, outUnits, products: new Set(filteredMovements.map((m) => m.product_id)).size };
  }, [filteredMovements]);
  // La página actual, agrupada por día (con lo que entró y salió ese día en la página).
  const pageRows = filteredMovements.slice(moveBounds.start, moveBounds.end);
  const days = useMemo(() => {
    const groups: { key: string; label: string; rows: MovementRow[]; plus: number; minus: number }[] = [];
    for (const m of pageRows) {
      const key = dayKey(m.created_at);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: formatDate(m.created_at), rows: [], plus: 0, minus: 0 };
        groups.push(g);
      }
      g.rows.push(m);
      if (m.quantity > 0) g.plus += m.quantity;
      else g.minus += -m.quantity;
    }
    return groups;
  }, [pageRows]);

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
                  {people.length > 1 && (
                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      aria-label="Filtrar por persona"
                      className="h-7 rounded-full border border-border bg-card px-2.5 text-xs text-foreground"
                    >
                      <option value="">Todas las personas</option>
                      {people.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => void downloadMovementsExcel(filteredMovements)}
                    disabled={filteredMovements.length === 0}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Download className="h-3 w-3" />
                    Excel
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
          {movements.length >= 500 && !focusedProduct && (
            <p className="px-5 pb-3 text-xs text-muted-foreground">Mostramos los últimos 500 movimientos de esta sucursal. Para ver los de un producto en particular, tocá un movimiento y elegí “Ver todos los movimientos de este producto”.</p>
          )}
          {filteredMovements.length > 0 && (
            <div className="grid grid-cols-2 gap-2 border-b border-border px-5 pb-4 sm:grid-cols-4">
              {[
                { label: "Movimientos", value: filteredMovements.length.toLocaleString("es-AR"), tone: "text-foreground" },
                { label: "Productos distintos", value: totals.products.toLocaleString("es-AR"), tone: "text-foreground" },
                { label: "Unidades que entraron", value: `+${fmtQty(totals.inUnits)}`, tone: "text-success" },
                { label: "Unidades que salieron", value: `−${fmtQty(totals.outUnits)}`, tone: "text-danger" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-border px-3 py-2.5">
                  <p className={cn("text-lg font-bold tabular-nums", c.tone)}>{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>
          )}
          <CardContent className="p-0">
            {filteredMovements.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                {movements.length === 0
                  ? "Todavía no hay movimientos de stock."
                  : "No encontramos movimientos con esos filtros."}
              </p>
            ) : (
              <div>
                {days.map((g) => (
                  <section key={g.key}>
                    <div className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-y border-border bg-muted/60 px-5 py-1.5 text-xs backdrop-blur">
                      <span className="font-semibold text-foreground">{g.label}</span>
                      <span className="text-muted-foreground">
                        <span className="font-semibold text-success">{`+${fmtQty(g.plus)}`}</span>
                        {" / "}
                        <span className="font-semibold text-danger">{`−${fmtQty(g.minus)}`}</span>
                        {" unidades"}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {g.rows.map((m) => {
                        const meta = TYPE_META[m.type] ?? TYPE_META.ajuste;
                        const ref = cleanReference(m.reference);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setDetail(m)}
                            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
                          >
                            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
                              <meta.icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{m.product_name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {`${movementTypeLabels[m.type] ?? m.type}${ref ? ` · ${ref}` : ""}`}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {`${formatTime(m.created_at)}${m.product_sku ? ` · SKU ${m.product_sku}` : ""}${m.user_label ? ` · ${m.user_label}` : ""}`}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={cn("text-base font-bold tabular-nums", m.quantity < 0 ? "text-danger" : "text-success")}>
                                {`${m.quantity > 0 ? "+" : "−"}${fmtQty(Math.abs(m.quantity))}`}
                                <span className="ml-0.5 text-xs font-medium text-muted-foreground">{m.unit ?? ""}</span>
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
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

      <Dialog open={detail !== null} onClose={() => setDetail(null)} title={detail?.product_name ?? "Movimiento"} description={detail ? TYPE_META[detail.type]?.text : undefined}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">{movementTypeLabels[detail.type] ?? detail.type}</span>
              <span className={cn("text-2xl font-bold tabular-nums", detail.quantity < 0 ? "text-danger" : "text-success")}>
                {`${detail.quantity > 0 ? "+" : "−"}${fmtQty(Math.abs(detail.quantity))} ${detail.unit ?? ""}`}
              </span>
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Fecha y hora</dt>
              <dd className="text-foreground">{formatDateTime(detail.created_at)}</dd>
              {detail.user_label && (
                <>
                  <dt className="text-muted-foreground">Hecho por</dt>
                  <dd className="text-foreground">{detail.user_label}</dd>
                </>
              )}
              {cleanReference(detail.reference) && (
                <>
                  <dt className="text-muted-foreground">Detalle</dt>
                  <dd className="text-foreground">{cleanReference(detail.reference)}</dd>
                </>
              )}
              {detail.product_sku && (
                <>
                  <dt className="text-muted-foreground">SKU</dt>
                  <dd className="text-foreground">{detail.product_sku}</dd>
                </>
              )}
              {detail.product_barcode && (
                <>
                  <dt className="text-muted-foreground">Código de barras</dt>
                  <dd className="text-foreground">{detail.product_barcode}</dd>
                </>
              )}
              {detail.stock_now !== null && detail.stock_now !== undefined && (
                <>
                  <dt className="text-muted-foreground">Stock actual</dt>
                  <dd className="text-foreground">{`${fmtQty(detail.stock_now)} ${detail.unit ?? ""}`}</dd>
                </>
              )}
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              {!focusedProduct && (
                <Link
                  href={`/productos?tab=movimientos&producto=${detail.product_id}`}
                  prefetch={false}
                  className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Ver todos los movimientos de este producto
                </Link>
              )}
              <Button onClick={() => setDetail(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Dialog>

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
