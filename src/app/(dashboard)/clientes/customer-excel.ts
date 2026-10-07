import { dayKey } from "@/lib/supplier-debt";
import { CUSTOMER_TEMPLATE_COLUMNS } from "@/lib/customer-import";
import type { ClienteRow } from "@/app/(dashboard)/clientes/clientes-client";

const INVOICE_LABEL: Record<string, string> = {
  consumidor_final: "Consumidor final",
  factura_a: "Factura A",
  factura_b: "Factura B",
  factura_c: "Factura C",
};

/** "2026-10-07T..." -> "07/10/2026" (hora argentina). */
function fullDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = dayKey(iso).split("-");
  return `${d}/${m}/${y}`;
}

type Cell = { value: string | number; fontWeight?: "bold"; backgroundColor?: string; format?: string };

/**
 * Baja los clientes a Excel. La planilla trae el ID de Pesito (para volver a
 * subirla sin duplicar) y, en gris, lo que es sólo para mirar: el saldo y las
 * fechas. Esas columnas NO se importan: el fiado sólo cambia con ventas y cobros.
 */
export async function downloadCustomersExcel(rows: readonly ClienteRow[], todayKey: string, onlyDebt = false) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const list = onlyDebt ? rows.filter((r) => r.balance > 0) : rows;

  const editable = ["ID", ...CUSTOMER_TEMPLATE_COLUMNS.map((c) => c.title)];
  const readOnly = ["Saldo", "Debe desde", "Último pago", "Última compra"];
  const header: Cell[] = [
    ...editable.map((value) => ({ value, fontWeight: "bold" as const })),
    ...readOnly.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#e5e7eb" })),
  ];

  const body: Cell[][] = list.map((c) => [
    { value: c.id },
    { value: c.name },
    { value: c.razon_social ?? "" },
    { value: c.phone ?? "" },
    { value: c.email ?? "" },
    { value: c.document ?? "" },
    { value: c.invoice_type ? (INVOICE_LABEL[c.invoice_type] ?? "") : "" },
    { value: c.notes ?? "" },
    { value: c.balance, format: "#,##0.00", backgroundColor: "#f3f4f6" },
    { value: c.balance > 0 ? fullDate(c.debtSince) : "", backgroundColor: "#f3f4f6" },
    { value: fullDate(c.lastPaymentAt), backgroundColor: "#f3f4f6" },
    { value: fullDate(c.lastSaleAt), backgroundColor: "#f3f4f6" },
  ]);

  await writeXlsxFile([header, ...body], {
    columns: [
      { width: 38 },
      { width: 28 },
      { width: 24 },
      { width: 18 },
      { width: 26 },
      { width: 16 },
      { width: 18 },
      { width: 30 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ],
  }).toFile(`pesito-${onlyDebt ? "deudas-de-clientes" : "clientes"}-${todayKey}.xlsx`);
}

export async function downloadCustomerTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = CUSTOMER_TEMPLATE_COLUMNS.map((c) => ({ value: c.title, fontWeight: "bold" as const }));
  const example = CUSTOMER_TEMPLATE_COLUMNS.map((c) => c.example);
  await writeXlsxFile([header, example], {
    columns: CUSTOMER_TEMPLATE_COLUMNS.map((c) => ({ width: Math.max(16, c.title.length + 6) })),
  }).toFile("pesito-clientes.xlsx");
}
