import { requiredHeader } from "@/lib/excel-headers";
import { saveProtectedXlsx } from "@/lib/excel-protect";
import { dayKey } from "@/lib/supplier-debt";
import type { StockRow, StockStatus } from "@/lib/stock-rows";

const STATUS_LABEL: Record<StockStatus, string> = {
  out: "Sin stock",
  low: "Por agotarse",
  ok: "OK",
  excess: "Sin ventas",
};

type Cell = { value: string | number; fontWeight?: "bold"; backgroundColor?: string; format?: string };

/**
 * Número sin separador de miles (se puede editar y volver a subir): entero sin decimales, y con `decimals` decimales si
 * tiene. Vacío (sin formato: la librería no lo admite en una celda vacía) si no hay dato.
 */
function num(value: number | null | undefined, decimals = 2): Cell {
  if (value === null || value === undefined) return { value: "" };
  return { value, format: Number.isInteger(value) ? "0" : `0.${"0".repeat(decimals)}` };
}

/** "2026-10-07T..." -> "2026-10-07" (hora argentina), para el nombre del archivo. */
function todayStamp(): string {
  return dayKey(new Date().toISOString());
}

export interface ExcelColumn {
  id: string;
  label: string;
  width: number;
  /** Sólo con el Plan Max (necesita las ventas por producto). */
  max?: boolean;
  /** Se puede editar en la planilla y volver a subir (el resto es sólo para mirar y queda bloqueado). */
  editable?: boolean;
  cell: (r: StockRow) => Cell;
}

/** Columnas que se pueden elegir. "Producto" va siempre primero y no se elige. */
export const EXCEL_COLUMNS: ExcelColumn[] = [
  { id: "barcode", editable: true, label: "Código de barras", width: 20, cell: (r) => ({ value: r.barcode ?? "" }) },
  { id: "brand", editable: true, label: "Marca", width: 18, cell: (r) => ({ value: r.brand ?? "" }) },
  { id: "supplier", editable: true, label: "Proveedor", width: 24, cell: (r) => ({ value: r.supplier ?? "" }) },
  { id: "stock", label: "Stock", width: 12, cell: (r) => num(r.stock) },
  { id: "unit", editable: true, label: "Unidad", width: 10, cell: (r) => ({ value: r.unit }) },
  { id: "minStock", editable: true, label: "Mínimo", width: 12, cell: (r) => num(r.minStock) },
  { id: "missing", label: "Falta para el mínimo", width: 20, cell: (r) => num(Math.max(0, r.minStock - r.stock)) },
  {
    id: "days",
    label: "Alcanza para (días)",
    width: 20,
    max: true,
    // Sin ventas en el período no se puede estimar: la celda queda vacía.
    cell: (r) => num(r.daysLeft === null || r.daysLeft === undefined ? null : Math.floor(r.daysLeft)),
  },
  { id: "status", label: "Estado", width: 14, cell: (r) => ({ value: STATUS_LABEL[r.status] }) },
  { id: "cost", editable: true, label: "Costo", width: 14, cell: (r) => num(r.cost) },
  { id: "value", label: "Valor al costo", width: 16, cell: (r) => num(r.value) },
  { id: "price", editable: true, label: "Precio de venta", width: 16, cell: (r) => num(r.price) },
  {
    id: "markup",
    editable: true,
    label: "Ganancia sobre el costo (%)",
    width: 26,
    cell: (r) => num(r.cost !== null && r.cost > 0 ? Math.round((r.price / r.cost - 1) * 1000) / 10 : null, 1),
  },
];

/**
 * Baja a Excel los productos que se elijan, con las columnas que se elijan (`columnIds`; por
 * defecto todas las disponibles). El nombre y el SKU van siempre: el SKU identifica a cada producto, así la planilla se
 * puede editar y volver a subir desde "Cargar desde Excel".
 */
export async function downloadStockExcel(rows: readonly StockRow[], withCover: boolean, columnIds?: readonly string[]) {
  const columns = EXCEL_COLUMNS.filter((c) => (withCover || !c.max) && (!columnIds || columnIds.includes(c.id)));
  const header: Cell[] = [
    requiredHeader("Producto"),
    requiredHeader("SKU"),
    ...columns.map((c) => ({ value: c.label, fontWeight: "bold" as const, backgroundColor: "#e5e7eb" })),
  ];
  const body: Cell[][] = rows.map((r) => [{ value: r.name }, { value: r.sku ?? "" }, ...columns.map((c) => c.cell(r))]);

  // Se edita el nombre y lo que se puede volver a subir; el SKU (lo que identifica al producto) queda bloqueado en los
  // productos que ya están (en filas nuevas se completa) y lo calculado (stock, estado, valor...) queda bloqueado.
  const editable = [0, ...columns.flatMap((c, i) => (c.editable ? [i + 2] : []))];
  await saveProtectedXlsx(
    [{ data: [header, ...body], columns: [{ width: 38 }, { width: 16 }, ...columns.map((c) => ({ width: c.width }))], stickyRowsCount: 1 }],
    `pesito-stock-${todayStamp()}.xlsx`,
    [{ editable, keys: [1] }]
  );
}
