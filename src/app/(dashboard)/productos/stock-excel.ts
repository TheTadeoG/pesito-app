import { dayKey } from "@/lib/supplier-debt";
import type { StockRow, StockStatus } from "@/lib/stock-rows";

const STATUS_LABEL: Record<StockStatus, string> = {
  out: "Sin stock",
  low: "Por agotarse",
  ok: "OK",
  excess: "Sin ventas",
};

type Cell = { value: string | number; fontWeight?: "bold"; backgroundColor?: string; format?: string };

/** Número con formato; vacío (sin formato: la librería no lo admite en una celda vacía) si no hay dato. */
function num(value: number | null | undefined, format: string): Cell {
  return value === null || value === undefined ? { value: "" } : { value, format };
}

/** "2026-10-07T..." -> "2026-10-07" (hora argentina), para el nombre del archivo. */
function todayStamp(): string {
  return dayKey(new Date().toISOString());
}

export interface ExcelColumn {
  id: string;
  label: string;
  width: number;
  /** Sólo con el Plan IA (necesita las ventas por producto). */
  ia?: boolean;
  cell: (r: StockRow) => Cell;
}

/** Columnas que se pueden elegir. "Producto" va siempre primero y no se elige. */
export const EXCEL_COLUMNS: ExcelColumn[] = [
  { id: "sku", label: "SKU", width: 16, cell: (r) => ({ value: r.sku ?? "" }) },
  { id: "barcode", label: "Código de barras", width: 20, cell: (r) => ({ value: r.barcode ?? "" }) },
  { id: "brand", label: "Marca", width: 18, cell: (r) => ({ value: r.brand ?? "" }) },
  { id: "supplier", label: "Proveedor", width: 24, cell: (r) => ({ value: r.supplier ?? "" }) },
  { id: "stock", label: "Stock", width: 12, cell: (r) => num(r.stock, "#,##0.##") },
  { id: "unit", label: "Unidad", width: 10, cell: (r) => ({ value: r.unit }) },
  { id: "minStock", label: "Mínimo", width: 12, cell: (r) => num(r.minStock, "#,##0.##") },
  { id: "missing", label: "Falta para el mínimo", width: 20, cell: (r) => num(Math.max(0, r.minStock - r.stock), "#,##0.##") },
  {
    id: "days",
    label: "Alcanza para (días)",
    width: 20,
    ia: true,
    // Sin ventas en el período no se puede estimar: la celda queda vacía.
    cell: (r) => num(r.daysLeft === null || r.daysLeft === undefined ? null : Math.floor(r.daysLeft), "#,##0"),
  },
  { id: "status", label: "Estado", width: 14, cell: (r) => ({ value: STATUS_LABEL[r.status] }) },
  { id: "cost", label: "Costo", width: 14, cell: (r) => num(r.cost, "#,##0.00") },
  { id: "value", label: "Valor al costo", width: 16, cell: (r) => num(r.value, "#,##0.00") },
  { id: "price", label: "Precio de venta", width: 16, cell: (r) => num(r.price, "#,##0.00") },
];

/**
 * Baja a Excel los productos que se elijan, con las columnas que se elijan (`columnIds`; por
 * defecto todas las disponibles). Todo es para mirar: no se vuelve a importar (para cargar o
 * corregir productos hay una planilla aparte).
 */
export async function downloadStockExcel(rows: readonly StockRow[], withCover: boolean, columnIds?: readonly string[]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const columns = EXCEL_COLUMNS.filter((c) => (withCover || !c.ia) && (!columnIds || columnIds.includes(c.id)));
  const header: Cell[] = [
    { value: "Producto", fontWeight: "bold", backgroundColor: "#e5e7eb" },
    ...columns.map((c) => ({ value: c.label, fontWeight: "bold" as const, backgroundColor: "#e5e7eb" })),
  ];
  const body: Cell[][] = rows.map((r) => [{ value: r.name }, ...columns.map((c) => c.cell(r))]);

  await writeXlsxFile([header, ...body], {
    columns: [{ width: 38 }, ...columns.map((c) => ({ width: c.width }))],
    stickyRowsCount: 1,
  }).toFile(`pesito-stock-${todayStamp()}.xlsx`);
}
