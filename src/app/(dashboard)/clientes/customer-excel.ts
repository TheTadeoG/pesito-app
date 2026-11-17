import { LOCKED_SHEET, allColumnsEditable, saveProtectedXlsx } from "@/lib/excel-protect";
import { customerCode } from "@/lib/codes";
import { columnHeader, optionalHeader } from "@/lib/excel-headers";
import { dayKey } from "@/lib/supplier-debt";
import { CUSTOMER_TEMPLATE_COLUMNS } from "@/lib/customer-import";
import type { ClienteRow } from "@/app/(dashboard)/clientes/clientes-client";

const INVOICE_LABEL: Record<string, string> = {
  consumidor_final: "Consumidor final",
  factura_a: "Factura A",
  factura_b: "Factura B",
  factura_c: "Factura C",
};

const TAX_CONDITION_LABEL: Record<string, string> = {
  responsable_inscripto: "Responsable inscripto",
  monotributo: "Monotributo",
  exento: "IVA exento",
  no_alcanzado: "IVA no alcanzado",
  consumidor_final: "Consumidor final",
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
  const list = onlyDebt ? rows.filter((r) => r.balance > 0) : rows;

  const readOnly = ["Código", "Saldo", "Debe desde", "Último pago", "Última compra"];
  // Lo obligatorio va en rojo con asterisco; "ID" y lo de sólo lectura no se completan a mano.
  const header: Cell[] = [
    optionalHeader("ID", "#e5e7eb"),
    ...CUSTOMER_TEMPLATE_COLUMNS.map((c) => columnHeader(c.title, c.required)),
    ...readOnly.map((value) => optionalHeader(value, "#e5e7eb")),
  ];

  const body: Cell[][] = list.map((c) => [
    { value: c.id },
    { value: c.name },
    { value: c.razon_social ?? "" },
    { value: c.phone ?? "" },
    { value: c.email ?? "" },
    { value: c.document ?? "" },
    { value: c.address ?? "" },
    { value: c.city ?? "" },
    { value: c.postal_code ?? "" },
    { value: c.province ?? "" },
    { value: c.tax_condition ? (TAX_CONDITION_LABEL[c.tax_condition] ?? "") : "" },
    { value: c.invoice_type ? (INVOICE_LABEL[c.invoice_type] ?? "") : "" },
    { value: c.notes ?? "" },
    { value: customerCode(c.code) ?? "", backgroundColor: "#f3f4f6" },
    { value: c.balance, format: "#,##0.00", backgroundColor: "#f3f4f6" },
    { value: c.balance > 0 ? fullDate(c.debtSince) : "", backgroundColor: "#f3f4f6" },
    { value: fullDate(c.lastPaymentAt), backgroundColor: "#f3f4f6" },
    { value: fullDate(c.lastSaleAt), backgroundColor: "#f3f4f6" },
  ]);

  // Se editan los datos del cliente (columnas de la planilla modelo); el ID, el código, el saldo y las fechas quedan
  // bloqueados: el saldo sólo cambia con ventas y cobros.
  await saveProtectedXlsx(
    [{ data: [header, ...body], columns: [
      { width: 38 },
      { width: 28 },
      { width: 24 },
      { width: 18 },
      { width: 26 },
      { width: 16 },
      { width: 30 },
      { width: 18 },
      { width: 10 },
      { width: 18 },
      { width: 22 },
      { width: 18 },
      { width: 30 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ], }],
    `pesito-${onlyDebt ? "deudas-de-clientes" : "clientes"}-${todayKey}.xlsx`,
    [{ editable: CUSTOMER_TEMPLATE_COLUMNS.map((_, i) => i + 1) }]
  );
}

export async function downloadCustomerTemplate() {
  const header = CUSTOMER_TEMPLATE_COLUMNS.map((c) => columnHeader(c.title, c.required));
  const example = CUSTOMER_TEMPLATE_COLUMNS.map((c) => c.example);
  await saveProtectedXlsx(
    [
    { data: [header, example], sheet: "Clientes", columns: CUSTOMER_TEMPLATE_COLUMNS.map((c) => ({ width: Math.max(16, c.title.length + 6) })), stickyRowsCount: 1 },
    {
      data: [
        [{ value: "Cómo completar la planilla", fontWeight: "bold" as const }],
        [{ value: "* Las columnas en rojo son obligatorias: Nombre. Las demás son opcionales." }],
        [{ value: "Si un cliente ya existe (mismo documento, email o teléfono) no se duplica." }],
        [{ value: "La primera fila de la hoja “Clientes” es un ejemplo: borrala o reemplazala." }],
      ],
      sheet: "Cómo completarla",
      columns: [{ width: 100 }],
    },
    ],
    "pesito-clientes.xlsx",
    [allColumnsEditable(CUSTOMER_TEMPLATE_COLUMNS.length), LOCKED_SHEET]
  );
}
