"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";
import { getPeriodRange, type ReportPeriod } from "@/lib/report-periods";
import type { Product } from "@/lib/types";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";

interface MovementRow {
  id: string;
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

const movementTypes = ["venta", "compra", "ajuste", "apertura"] as const;
const movementTypeLabels: Record<string, string> = {
  venta: "Venta",
  compra: "Compra",
  ajuste: "Ajuste",
  apertura: "Apertura",
};

export function InventarioClient({
  products,
  movements,
}: {
  products: Product[];
  movements: MovementRow[];
}) {
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [period, setPeriod] = useState<MovementPeriod>("30d");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [movementQuery, setMovementQuery] = useState("");
  const lowStock = products.filter((p) => p.stock <= p.min_stock);

  const filteredMovements = useMemo(() => {
    const start = period === "all" ? null : getPeriodRange(period).start;
    const q = movementQuery.trim().toLowerCase();

    return movements.filter((m) => {
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
  }, [movements, period, typeFilter, movementQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          El stock, costo y precio de cada producto se manejan desde Productos. Acá ves el stock
          bajo y el historial de movimientos.
        </p>
        <Link href="/productos">
          <Button variant="outline" size="sm">
            Ir a Productos
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <Card className={lowStock.length > 0 ? "border-danger/30 bg-danger-bg/40" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">
            {lowStock.length > 0
              ? `${lowStock.length} producto${lowStock.length > 1 ? "s" : ""} por debajo del stock mínimo`
              : "Stock mínimo"}
          </CardTitle>
        </CardHeader>
        <CardContent className={lowStock.length > 0 ? "p-0" : undefined}>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún producto está por debajo de su stock mínimo.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {lowStock.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock: <span className="font-medium text-danger">{product.stock}{product.unit}</span>
                      {" · "}Mínimo: {product.min_stock}{product.unit}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAdjusting(product)}>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Ajustar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos de stock</CardTitle>
          <div className="mt-3 space-y-3">
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
              {filteredMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(m.created_at)}
                      {m.product_sku ? ` · SKU ${m.product_sku}` : ""}
                      {m.reference ? ` · ${m.reference}` : ""}
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
      </Card>

      <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}
