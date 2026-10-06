import type { SupplierRow } from "@/lib/supplier-overview";
import type { DebtStatus } from "@/lib/supplier-debt";

const STATUS_LABEL: Record<DebtStatus, string> = {
  vencida: "Vencida",
  pronto: "Vence pronto",
  no_vencida: "No vencida",
  sin_fecha: "Sin fecha",
};

/** "2026-10-07" -> "07/10/2026". */
function fullDate(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** Baja a Excel lo que se debe, compra por compra y con su vencimiento. */
export async function downloadDebtExcel(rows: readonly SupplierRow[], todayKey: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const titles = ["Proveedor", "Teléfono", "Fecha de la compra", "Vencimiento", "Estado", "Lo que se debe"];
  const header = titles.map((value) => ({ value, fontWeight: "bold" as const }));

  const body: { value: string | number; format?: string; fontWeight?: "bold" }[][] = [];
  let total = 0;
  for (const supplier of rows) {
    for (const item of supplier.items) {
      total += item.amount;
      body.push([
        { value: supplier.name },
        { value: supplier.phone ?? "" },
        { value: fullDate(item.purchaseDay) },
        { value: item.dueDate ? fullDate(item.dueDate) : "" },
        { value: STATUS_LABEL[item.status] },
        { value: item.amount, format: "#,##0.00" },
      ]);
    }
  }
  body.push([
    { value: "Total", fontWeight: "bold" },
    { value: "" },
    { value: "" },
    { value: "" },
    { value: "" },
    { value: total, format: "#,##0.00", fontWeight: "bold" },
  ]);

  await writeXlsxFile([header, ...body], {
    columns: [{ width: 30 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 18 }],
  }).toFile(`pesito-deuda-proveedores-${todayKey}.xlsx`);
}
