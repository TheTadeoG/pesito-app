// Fila de producto con su estado de stock: la comparten la pestaña Stock (lista de excepciones),
// Productos (filtros por estado) y la planilla de Excel. Sin código de servidor: la usa el navegador.

export type StockStatus = "out" | "low" | "ok" | "excess";

export interface StockRow {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string;
  stock: number;
  minStock: number;
  cost: number | null;
  price: number;
  supplier: string | null;
  status: StockStatus;
  /** Días que alcanza el stock (Plan IA): 0 sin stock, null si no se vendió en el período, undefined sin el plan. */
  daysLeft: number | null | undefined;
  /** Stock × costo. */
  value: number;
}

export interface StockSource {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode?: string | null;
  unit: string;
  stock: number;
  min_stock: number;
  cost: number | null;
  price: number;
}

/** Sin stock (0 o menos), por agotarse (en el mínimo o debajo), sin ventas (sólo si se conoce) u OK. */
export function stockStatusOf(stock: number, minStock: number, idle = false): StockStatus {
  return stock <= 0 ? "out" : stock <= minStock ? "low" : idle ? "excess" : "ok";
}

export function toStockRow(
  p: StockSource,
  extra: { supplier: string | null; idle?: boolean; daysLeft?: number | null }
): StockRow {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand?.trim() || null,
    sku: p.sku,
    barcode: p.barcode ?? null,
    unit: p.unit,
    stock: p.stock,
    minStock: p.min_stock,
    cost: p.cost,
    price: p.price,
    supplier: extra.supplier,
    status: stockStatusOf(p.stock, p.min_stock, extra.idle ?? false),
    daysLeft: extra.daysLeft,
    value: p.stock * (p.cost ?? 0),
  };
}

/** Filtros por estado del stock de Productos (y los links de "Revisar números" de Stock: ?estado=). */
export type StockFilterState = "out" | "low" | "idle" | "nocost" | "nomin" | "negative";

const ESTADO_PARAMS: Record<string, StockFilterState> = {
  "sin-stock": "out",
  "por-agotarse": "low",
  "sin-ventas": "idle",
  "sin-costo": "nocost",
  "sin-minimo": "nomin",
  negativo: "negative",
};

export function parseStockFilterState(value: string | undefined): StockFilterState | null {
  return (value && ESTADO_PARAMS[value]) || null;
}
