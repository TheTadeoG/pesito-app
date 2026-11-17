import { optionalHeader, requiredHeader } from "@/lib/excel-headers";
import { supplierCode } from "@/lib/codes";
import { getSuppliersForExport } from "@/app/(dashboard)/proveedores/import-actions";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Baja los proveedores a Excel. Las primeras columnas (Nombre, Teléfono, Email, Notas, Plazo de entrega) son las mismas
 * de la planilla de carga, así se puede volver a subir; las demás son para mirar.
 */
export async function downloadSuppliersExcel(): Promise<string | null> {
  const res = await getSuppliersForExport();
  if (res.error || !res.rows) return res.error ?? "No pudimos cargar los proveedores.";
  if (res.rows.length === 0) return "Todavía no cargaste proveedores.";
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const head = [
    optionalHeader("Código", "#e5e7eb"),
    requiredHeader("Nombre"),
    ...["Teléfono", "Email", "Notas", "Plazo de entrega (días)"].map((t) => optionalHeader(t)),
    ...["Plazo de pago (días)", "Pedido mínimo ($)", "Días de entrega"].map((t) => optionalHeader(t, "#e5e7eb")),
  ];
  const num = (value: number | null) => (value === null ? { value: "" } : { value, format: Number.isInteger(value) ? "0" : "0.00" });
  const body = res.rows.map((r) => [
    { value: supplierCode(r.code) ?? "" },
    { value: r.name },
    { value: r.phone },
    { value: r.email },
    { value: r.notes },
    num(r.leadTimeDays),
    num(r.paymentTermsDays),
    num(r.minOrderAmount),
    { value: r.deliveryDays.map((d) => DAYS[d]).filter(Boolean).join(", ") },
  ]);
  await writeXlsxFile([head, ...body], {
    columns: [{ width: 12 }, { width: 30 }, { width: 18 }, { width: 28 }, { width: 34 }, { width: 22 }, { width: 20 }, { width: 18 }, { width: 24 }],
    stickyRowsCount: 1,
  }).toFile("pesito-proveedores.xlsx");
  return null;
}
