import { dayKey } from "@/lib/supplier-debt";
import type { StockRow, StockStatus } from "@/app/(dashboard)/productos/stock-board";

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

/**
 * Baja a Excel la lista de productos tal como se está viendo en la tabla (con los filtros y el
 * orden elegidos). Con el Plan IA suma cuántos días alcanza el stock. Todo es para mirar: no se
 * vuelve a importar (para cargar o corregir productos hay una planilla aparte).
 */
export async function downloadStockExcel(rows: readonly StockRow[], withCover: boolean) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const titles = [
    "Producto",
    "SKU",
    "Marca",
    "Proveedor",
    "Stock",
    "Unidad",
    "Mínimo",
    "Falta para el mínimo",
    ...(withCover ? ["Alcanza para (días)"] : []),
    "Estado",
    "Costo",
    "Valor al costo",
    "Precio de venta",
  ];
  const header: Cell[] = titles.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#e5e7eb" }));

  const body: Cell[][] = rows.map((r) => [
    { value: r.name },
    { value: r.sku ?? "" },
    { value: r.brand ?? "" },
    { value: r.supplier ?? "" },
    num(r.stock, "#,##0.##"),
    { value: r.unit },
    num(r.minStock, "#,##0.##"),
    num(Math.max(0, r.minStock - r.stock), "#,##0.##"),
    // Sin ventas en el período no se puede estimar: la celda queda vacía.
    ...(withCover ? [num(r.daysLeft === null || r.daysLeft === undefined ? null : Math.floor(r.daysLeft), "#,##0")] : []),
    { value: STATUS_LABEL[r.status] },
    num(r.cost, "#,##0.00"),
    num(r.value, "#,##0.00"),
    num(r.price, "#,##0.00"),
  ]);

  await writeXlsxFile([header, ...body], {
    columns: titles.map((t) => ({ width: t === "Producto" ? 38 : t === "Proveedor" ? 24 : t === "Marca" ? 18 : 15 })),
    stickyRowsCount: 1,
  }).toFile(`pesito-stock-${todayStamp()}.xlsx`);
}
