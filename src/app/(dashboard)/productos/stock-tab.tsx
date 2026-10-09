"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, PackagePlus, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { getPeriodRange, type ReportPeriod } from "@/lib/report-periods";
import type { Product } from "@/lib/types";
import type { Plan } from "@/lib/subscription";
import { StockBoard, type StockRow } from "@/app/(dashboard)/productos/stock-board";
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
// El "reference" de una venta es su id (un uuid): no le dice nada a nadie.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "$ 5,0 M" para los montos grandes en pantallas chicas. */
function shortMoney(value: number): string {
  return value >= 1_000_000 ? `$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} M` : formatCurrency(value);
}

function Kpi({
  label,
  shortLabel,
  value,
  short,
  alert,
  onClick,
}: {
  label: string;
  /** Nombre corto para el celular. */
  shortLabel?: string;
  value: string;
  /** Valor corto para el celular. */
  short?: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="block truncate text-[11px] text-muted-foreground sm:text-xs">
        <span className="sm:hidden">{shortLabel ?? label}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
      <span className={cn("block truncate text-base font-bold sm:text-xl lg:text-2xl", alert ? "text-danger" : "text-foreground")}>
        <span className="sm:hidden">{short ?? value}</span>
        <span className="hidden sm:inline">{value}</span>
      </span>
    </>
  );
  const base = "min-w-0 rounded-2xl border px-3 py-3 text-left sm:px-4";
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
  insights,
  insightsLockedPlan,
  focusedProduct,
}: {
  products: Product[];
  movements: MovementRow[];
  suppliers: { id: string; name: string }[];
  /** Plan IA: días que alcanza cada producto y plata parada (null sin el plan o si falló). */
  insights: { cover: Record<string, number | null>; slow: { id: string; capital: number }[] } | null;
  /** Plan que desbloquea los datos anteriores (null si el negocio ya lo tiene). */
  insightsLockedPlan: Plan | null;
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
  const [moveLimit, setMoveLimit] = useState({ key: "", n: MOVEMENTS_PAGE });
  const supplierNameById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );

  const slowIds = useMemo(() => new Set((insights?.slow ?? []).map((r) => r.id)), [insights]);
  const rows = useMemo<StockRow[]>(
    () =>
      products.map((p) => {
        const status: StockRow["status"] =
          p.stock <= 0 ? "out" : p.stock <= p.min_stock ? "low" : slowIds.has(p.id) ? "excess" : "ok";
        return {
          id: p.id,
          name: p.name,
          brand: p.brand?.trim() || null,
          sku: p.sku,
          unit: p.unit,
          stock: p.stock,
          minStock: p.min_stock,
          cost: p.cost,
          supplier: p.default_supplier_id ? (supplierNameById.get(p.default_supplier_id) ?? null) : null,
          status,
          daysLeft: insights ? (insights.cover[p.id] ?? null) : undefined,
          value: p.stock * (p.cost ?? 0),
        };
      }),
    [products, slowIds, insights, supplierNameById]
  );
  const slowTop = useMemo(() => {
    const nameById = new Map(products.map((p) => [p.id, p.name]));
    return (insights?.slow ?? [])
      .map((r) => ({ id: r.id, name: nameById.get(r.id) ?? "Producto", capital: r.capital }))
      .sort((x, y) => y.capital - x.capital);
  }, [insights, products]);
  const brandOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.brand).filter((b): b is string => Boolean(b)))).sort((x, y) => x.localeCompare(y)),
    [rows]
  );
  const supplierOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.supplier).filter((x): x is string => Boolean(x)))).sort((x, y) => x.localeCompare(y)),
    [rows]
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
      {/* Cuánto tenés, en tres números; abajo, lo que hay que hacer y la tabla de productos. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Kpi label="Unidades en stock" shortLabel="Unidades" value={formatQty(valuation.totalUnits)} />
        <Kpi label="Valor al costo" shortLabel="Al costo" value={formatCurrency(valuation.totalCost)} short={shortMoney(valuation.totalCost)} />
        <Kpi
          label="Valor a precio de venta"
          shortLabel="A la venta"
          value={formatCurrency(valuation.totalPrice)}
          short={shortMoney(valuation.totalPrice)}
        />
      </div>

      <StockBoard
        rows={rows}
        brands={brandOptions}
        suppliers={supplierOptions}
        insightsOn={insights !== null}
        lockedPlan={insightsLockedPlan}
        slow={slowTop}
        restockHref={insightsLockedPlan ? null : "/recomendaciones"}
      />

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
