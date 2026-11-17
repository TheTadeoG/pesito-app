import { LOCKED_SHEET, allColumnsEditable, saveProtectedXlsx } from "@/lib/excel-protect";
import { SUPPLIER_TEMPLATE_COLUMNS } from "@/lib/supplier-import";

// Planilla modelo (vacía) para cargar proveedores.
export async function downloadSupplierTemplate() {
  const header = SUPPLIER_TEMPLATE_COLUMNS.map((c) =>
    c.required
      ? { value: `${c.title} *`, fontWeight: "bold" as const, textColor: "#b91c1c", backgroundColor: "#fee2e2" }
      : { value: c.title, fontWeight: "bold" as const, backgroundColor: "#f3f4f6" }
  );
  const example = SUPPLIER_TEMPLATE_COLUMNS.map((c) => c.example);
  await saveProtectedXlsx(
    [
    { data: [header, example], sheet: "Proveedores", columns: SUPPLIER_TEMPLATE_COLUMNS.map((c) => ({ width: Math.max(18, c.title.length + 6) })), stickyRowsCount: 1 },
    {
      data: [
        [{ value: "Cómo completar la planilla", fontWeight: "bold" as const }],
        [{ value: "* Sólo el Nombre es obligatorio. Las demás columnas son opcionales." }],
        [{ value: "Los proveedores que ya tengas cargados con el mismo nombre no se duplican ni se modifican." }],
        [{ value: "La primera fila de la hoja “Proveedores” es un ejemplo: borrala o reemplazala." }],
      ],
      sheet: "Cómo completarla",
      columns: [{ width: 100 }],
    },
    ],
    "pesito-proveedores.xlsx",
    [allColumnsEditable(SUPPLIER_TEMPLATE_COLUMNS.length), LOCKED_SHEET]
  );
}
