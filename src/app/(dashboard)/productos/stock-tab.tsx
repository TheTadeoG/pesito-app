"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, PackagePlus, Search, ShoppingCart, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { getPeriodRange, type ReportPeriod } from "@/lib/report-periods";
import type { Product } from "@/lib/types";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";

interface ValuationRow {
  label: string;
  units: number;
  value: number;
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// Componente aparte (no inline) porque se usa dos veces (marca y proveedor)
// y react-hooks/static-components no permite definir componentes dentro del
// render de otro.
const BREAKDOWN_PREVIEW = 8;

function ValuationBreakdownCard({ title, rows }: { title: string; rows: ValuationRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const maxValue = rows[0]?.value ?? 0;
  const shown = showAll ? rows : rows.slice(0, BREAKDOWN_PREVIEW);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Sin datos todavía.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {shown.map((row) => (
              <div key={row.label} className="space-y-1.5 px-5 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">{row.label}</span>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatCurrency(row.value)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: maxValue > 0 ? `${Math.max((row.value / maxValue) * 100, 2)}%` : "0%",
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatQty(row.units)} un.
                  </span>
                </div>
              </div>
            ))}
            {rows.length > BREAKDOWN_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full px-5 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted"
              >
                {showAll ? "Ver menos" : `Ver las ${rows.length}`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MOVEMENTS_PAGE = 30;
const LOW_STOCK_PREVIEW = 8;
const LOW_STOCK_PAGE = 20;
// El "reference" de una venta es su id (un uuid): no le dice nada a nadie.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Kpi({
  label,
  value,
  alert,
  onClick,
}: {
  label: string;
  value: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("block text-xl font-bold sm:text-2xl", alert ? "text-danger" : "text-foreground")}>
        {value}
      </span>
    </>
  );
  const base = "rounded-2xl border px-4 py-3 text-left";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(base, "transition-colors", alert ? "border-danger/30 bg-danger-bg/40 hover:bg-danger-bg/70" : "border-border bg-card hover:bg-muted")}
    >
      {content}
    </button>
  ) : (
    <div className={cn(base, "border-border bg-card")}>{content}</div>
  );
}

// Sección plegable: cabecera con un resumen en una línea; el contenido se ve al abrirla.
function Fold({
  title,
  summary,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3.5 text-left transition-colors hover:bg-muted"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
            <span className="text-base font-semibold text-foreground">{title}</span>
          </span>
          <span className="hidden truncate text-xs text-muted-foreground sm:block">{summary}</span>
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}

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

export function StockTab({
  products,
  movements,
  suppliers,
  focusedProduct,
}: {
  products: Product[];
  movements: MovementRow[];
  suppliers: { id: string; name: string }[];
  // Viene de "Ver movimientos" en la tabla de productos.
  focusedProduct: { id: string; name: string } | null;
}) {
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [period, setPeriod] = useState<MovementPeriod>(focusedProduct ? "all" : "30d");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [movementQuery, setMovementQuery] = useState("");
  // Stock bajo siempre a la vista (es lo que hay que atender); valorización y movimientos
  // plegados. Si se viene de "Ver movimientos" de un producto, se abren los movimientos.
  const [openValuation, setOpenValuation] = useState(false);
  const [openMoves, setOpenMoves] = useState(Boolean(focusedProduct));
  const [lowLimit, setLowLimit] = useState(LOW_STOCK_PREVIEW);
  const [moveLimit, setMoveLimit] = useState({ key: "", n: MOVEMENTS_PAGE });
  // Lo que más falta primero (la diferencia con el mínimo, de menor a mayor).
  const lowStock = useMemo(
    () =>
      products
        .filter((p) => p.stock <= p.min_stock)
        .sort((a, b) => a.stock - a.min_stock - (b.stock - b.min_stock) || a.name.localeCompare(b.name)),
    [products]
  );

  const supplierNameById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );

  const valuation = useMemo(() => {
    let totalUnits = 0;
    let totalCost = 0;
    let totalPrice = 0;
    const byBrand = new Map<string, ValuationRow>();
    const bySupplier = new Map<string, ValuationRow>();

    for (const p of products) {
      const cost = p.cost ?? 0;
      const value = p.stock * cost;
      totalUnits += p.stock;
      totalCost += value;
      totalPrice += p.stock * p.price;

      const brandLabel = p.brand?.trim() || "Sin marca";
      const brandEntry = byBrand.get(brandLabel) ?? { label: brandLabel, units: 0, value: 0 };
      brandEntry.units += p.stock;
      brandEntry.value += value;
      byBrand.set(brandLabel, brandEntry);

      const supplierKey = p.default_supplier_id ?? "__none__";
      const supplierLabel = p.default_supplier_id
        ? supplierNameById.get(p.default_supplier_id) ?? "Proveedor eliminado"
        : "Sin proveedor";
      const supplierEntry =
        bySupplier.get(supplierKey) ?? { label: supplierLabel, units: 0, value: 0 };
      supplierEntry.units += p.stock;
      supplierEntry.value += value;
      bySupplier.set(supplierKey, supplierEntry);
    }

    const sortByValue = (rows: Map<string, ValuationRow>) =>
      Array.from(rows.values()).sort((a, b) => b.value - a.value);

    return {
      totalUnits,
      totalCost,
      totalPrice,
      byBrand: sortByValue(byBrand),
      bySupplier: sortByValue(bySupplier),
    };
  }, [products, supplierNameById]);

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

  // Resumen del día para la cabecera plegada de Movimientos.
  const movementsSummary = useMemo(() => {
    const start = getPeriodRange("today").start;
    const counts = new Map<string, number>();
    for (const m of movements) {
      if (new Date(m.created_at) >= start) counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
    }
    if (counts.size === 0) return "Hoy: sin movimientos";
    const parts = movementTypes
      .filter((t) => counts.has(t))
      .map((t) => `${counts.get(t)} ${movementTypeLabels[t].toLowerCase()}${counts.get(t) === 1 ? "" : "s"}`);
    return `Hoy: ${parts.join(" · ")}`;
  }, [movements]);

  const moveKey = `${period}|${typeFilter ?? ""}|${movementQuery}|${focusedProduct?.id ?? ""}`;
  const moveLimitNow = moveLimit.key === moveKey ? moveLimit.n : MOVEMENTS_PAGE;

  return (
    <div className="space-y-5">
      {/* Primero cuánto tenés (unidades y valor); el stock bajo, al lado: al tocarlo baja a la lista. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Unidades en stock" value={formatQty(valuation.totalUnits)} />
        <Kpi label="Valor al costo" value={formatCurrency(valuation.totalCost)} />
        <Kpi label="Valor a precio de venta" value={formatCurrency(valuation.totalPrice)} />
        <Kpi
          label="Por debajo del mínimo"
          value={`${lowStock.length} producto${lowStock.length === 1 ? "" : "s"}`}
          alert={lowStock.length > 0}
          onClick={() => document.getElementById("stock-bajo")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </div>

      {/* Stock bajo, abierto: es lo primero que hay que atender. */}
      <Card id="stock-bajo" className={cn("scroll-mt-20", lowStock.length > 0 && "border-danger/30 bg-danger-bg/40")}>
        <CardHeader>
          <CardTitle className="text-base">
            {lowStock.length > 0
              ? `${lowStock.length} producto${lowStock.length > 1 ? "s" : ""} por debajo del stock mínimo`
              : "Stock mínimo"}
          </CardTitle>
          {lowStock.length > 0 && (
            <p className="text-xs text-muted-foreground">Primero los que más faltan.</p>
          )}
        </CardHeader>
        <CardContent className={lowStock.length > 0 ? "p-0" : undefined}>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún producto está por debajo de su stock mínimo.
            </p>
          ) : (
            // Una línea por producto. El CTA es "Comprar", no "Ajustar": lo que
            // falta se resuelve reponiendo mercadería, no corrigiendo el número a mano.
            <div className="divide-y divide-border">
              {lowStock.slice(0, lowLimit).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 px-5 py-2"
                >
                  <p className="min-w-0 truncate text-sm">
                    <span className="font-medium text-foreground">{product.name}</span>
                    <span className="text-muted-foreground">
                      {" — "}
                      <span className="font-medium text-danger">
                        {product.stock}
                        {product.unit}
                      </span>
                      {" / mín. "}
                      {product.min_stock}
                      {product.unit}
                    </span>
                  </p>
                  <Link
                    href={`/compras?producto=${product.id}`}
                    aria-label={`Comprar ${product.name}`}
                    className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Comprar</span>
                  </Link>
                </div>
              ))}
              {lowStock.length > lowLimit && (
                <button
                  type="button"
                  onClick={() => setLowLimit((n) => n + LOW_STOCK_PAGE)}
                  className="w-full px-5 py-3 text-center text-sm font-medium text-primary hover:bg-muted"
                >
                  {`Ver más (${lowStock.length - lowLimit} restantes)`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Fold
        title="Valorización por marca y proveedor"
        summary={`${valuation.byBrand.length} marca${valuation.byBrand.length === 1 ? "" : "s"} · ${valuation.bySupplier.length} proveedor${valuation.bySupplier.length === 1 ? "" : "es"}`}
        open={openValuation}
        onToggle={() => setOpenValuation((v) => !v)}
      >
        <div className="grid gap-4 lg:grid-cols-2">
        <ValuationBreakdownCard title="Valorización por marca" rows={valuation.byBrand} />
        <ValuationBreakdownCard title="Valorización por proveedor" rows={valuation.bySupplier} />
        </div>
      </Fold>

      <Fold
        title="Movimientos de stock"
        summary={movementsSummary}
        open={openMoves}
        onToggle={() => setOpenMoves((v) => !v)}
        action={
          <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
            <PackagePlus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo movimiento</span>
          </Button>
        }
      >
      <Card>
        <CardHeader>
          <div className="space-y-3">
            {focusedProduct && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Mostrando sólo</span>
                <Link
                  href="/productos?tab=stock"
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
              {filteredMovements.slice(0, moveLimitNow).map((m) => (
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
              {filteredMovements.length > moveLimitNow && (
                <button
                  type="button"
                  onClick={() => setMoveLimit({ key: moveKey, n: moveLimitNow + MOVEMENTS_PAGE })}
                  className="w-full px-5 py-3 text-center text-sm font-medium text-primary hover:bg-muted"
                >
                  {`Ver más (${filteredMovements.length - moveLimitNow} restantes)`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </Fold>

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
