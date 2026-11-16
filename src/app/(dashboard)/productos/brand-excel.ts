import { optionalHeader, requiredHeader } from "@/lib/excel-headers";

// Baja las marcas a Excel (nombre y cuántos productos tiene cada una). La planilla se puede volver a subir en
// "Cargar marcas desde Excel": reconoce la columna Nombre y ignora la de Productos.
export async function downloadBrandsExcel(brands: readonly { name: string }[], countByBrand: Record<string, number>) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const head = [requiredHeader("Nombre"), optionalHeader("Productos", "#e5e7eb")];
  const body = [...brands]
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((b) => [{ value: b.name }, { value: countByBrand[b.name] ?? 0, format: "0" }]);
  await writeXlsxFile([head, ...body], { columns: [{ width: 34 }, { width: 12 }], stickyRowsCount: 1 }).toFile("pesito-marcas.xlsx");
}
