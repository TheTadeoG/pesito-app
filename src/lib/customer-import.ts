// Carga masiva de clientes desde una planilla (Excel o CSV).
//
// Corre en el navegador (lectura y vista previa) y se revalida en el servidor.
// Qué toca y qué NO toca:
//  - Crea clientes nuevos y, si se pide, actualiza datos de contacto de los que
//    ya existen (nombre, razón social, teléfono, mail, documento, tipo de factura
//    y notas). Una celda vacía nunca borra un dato que ya está cargado.
//  - NUNCA toca lo que el cliente debe (el saldo de fiado), ni sus ventas ni sus
//    pagos: el fiado sólo cambia vendiendo a fiado o registrando un cobro.

import { normalizeText } from "@/lib/product-import";

export { parseCsv } from "@/lib/product-import";

export const CUSTOMER_IMPORT_CHUNK_SIZE = 250;
export const CUSTOMER_IMPORT_MAX_ROWS = 20000;

export type InvoiceKind = "consumidor_final" | "factura_a" | "factura_b" | "factura_c";

export type CustomerUpdateField =
  | "name"
  | "razonSocial"
  | "phone"
  | "email"
  | "document"
  | "invoiceType"
  | "notes";

export const CUSTOMER_UPDATE_FIELDS: {
  field: CustomerUpdateField;
  label: string;
  hint: string;
  defaultOn: boolean;
}[] = [
  { field: "phone", label: "Teléfono", hint: "Si la celda está vacía, se deja el actual.", defaultOn: true },
  { field: "email", label: "Mail", hint: "Si la celda está vacía, se deja el actual.", defaultOn: true },
  { field: "document", label: "Documento (DNI o CUIT)", hint: "Si la celda está vacía, se deja el actual.", defaultOn: true },
  { field: "razonSocial", label: "Razón social", hint: "Si la celda está vacía, se deja la actual.", defaultOn: true },
  { field: "notes", label: "Notas", hint: "Si la celda está vacía, se dejan las actuales.", defaultOn: false },
  { field: "invoiceType", label: "Tipo de factura", hint: "Sólo si la planilla trae uno válido.", defaultOn: false },
  { field: "name", label: "Nombre", hint: "Cambia el nombre del cliente.", defaultOn: false },
];

export interface CustomerImportRow {
  /** Fila de la planilla (la 1 es el título), para avisar dónde está un error. */
  line: number;
  /** Id de Pesito (viene en las planillas que se exportan desde acá). */
  id: string;
  name: string;
  razonSocial: string;
  phone: string;
  email: string;
  document: string;
  invoiceType: InvoiceKind | null;
  notes: string;
}

export interface CustomerImportProblem {
  line: number;
  message: string;
}

export interface ParsedCustomerImport {
  rows: CustomerImportRow[];
  problems: CustomerImportProblem[];
  ignoredColumns: string[];
  /** Columnas que se leen sólo para mirar y no se importan (ej. Saldo). */
  readOnlyColumns: string[];
  missingColumns: string[];
}

type Field = "id" | "name" | "razonSocial" | "phone" | "email" | "document" | "invoiceType" | "notes";

/** Columnas de la planilla modelo (y de la exportación), en este orden. */
export const CUSTOMER_TEMPLATE_COLUMNS: { field: Field; title: string; required?: boolean; example: string }[] = [
  { field: "name", title: "Nombre", required: true, example: "Lucía Fernández" },
  { field: "razonSocial", title: "Razón social", example: "" },
  { field: "phone", title: "Teléfono", example: "11 5555-0101" },
  { field: "email", title: "Mail", example: "lucia@mail.com" },
  { field: "document", title: "Documento", example: "30123456" },
  { field: "invoiceType", title: "Tipo de factura", example: "Consumidor final" },
  { field: "notes", title: "Notas", example: "Vive en la esquina" },
];

const ALIASES: Record<Field, string[]> = {
  id: ["id", "id pesito", "id de pesito", "codigo pesito"],
  name: ["nombre", "cliente", "nombre y apellido", "nombre completo", "apellido y nombre", "nombre del cliente"],
  razonSocial: ["razon social", "empresa", "nombre fiscal"],
  phone: ["telefono", "tel", "celular", "whatsapp", "movil", "cel"],
  email: ["mail", "email", "e mail", "correo", "correo electronico"],
  document: ["documento", "dni", "cuit", "cuil", "cuit cuil", "dni cuit", "nro documento", "numero de documento"],
  invoiceType: ["tipo de factura", "factura", "tipo factura", "condicion", "condicion iva"],
  notes: ["notas", "nota", "observaciones", "comentarios", "obs"],
};

/** Columnas que se reconocen sólo para avisar que no se importan. */
const READ_ONLY_ALIASES: Record<string, string[]> = {
  Saldo: ["saldo", "saldo fiado", "deuda", "te debe", "debe", "saldo actual"],
  "Debe desde": ["debe desde"],
  "Último pago": ["ultimo pago"],
  "Última compra": ["ultima compra"],
};

function fieldForHeader(header: unknown): Field | null {
  const text = normalizeText(header);
  if (!text) return null;
  for (const field of Object.keys(ALIASES) as Field[]) {
    if (ALIASES[field].includes(text)) return field;
  }
  return null;
}

function readOnlyForHeader(header: unknown): string | null {
  const text = normalizeText(header);
  if (!text) return null;
  for (const [title, aliases] of Object.entries(READ_ONLY_ALIASES)) {
    if (aliases.includes(text)) return title;
  }
  return null;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

export function normalizeInvoiceType(value: unknown): InvoiceKind | null | "invalid" {
  const text = normalizeText(value);
  if (!text) return null;
  const map: Record<string, InvoiceKind> = {
    "consumidor final": "consumidor_final",
    cf: "consumidor_final",
    "consumidor": "consumidor_final",
    "factura a": "factura_a",
    a: "factura_a",
    "responsable inscripto": "factura_a",
    ri: "factura_a",
    "factura b": "factura_b",
    b: "factura_b",
    "factura c": "factura_c",
    c: "factura_c",
    monotributo: "factura_c",
    monotributista: "factura_c",
  };
  return map[text] ?? "invalid";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Convierte la planilla (filas de celdas, la primera con los títulos) en clientes a importar. */
export function parseCustomerSheet(matrix: unknown[][]): ParsedCustomerImport {
  const result: ParsedCustomerImport = {
    rows: [],
    problems: [],
    ignoredColumns: [],
    readOnlyColumns: [],
    missingColumns: [],
  };
  if (matrix.length === 0) return result;

  let headerIndex = 0;
  let best = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const recognized = matrix[i].filter((h) => fieldForHeader(h) || readOnlyForHeader(h)).length;
    if (recognized > best) {
      best = recognized;
      headerIndex = i;
    }
  }

  const columns = new Map<Field, number>();
  matrix[headerIndex].forEach((header, index) => {
    const field = fieldForHeader(header);
    const readOnly = readOnlyForHeader(header);
    if (field && !columns.has(field)) columns.set(field, index);
    else if (readOnly) result.readOnlyColumns.push(readOnly);
    else if (!field && cellText(header)) result.ignoredColumns.push(cellText(header));
  });

  if (!columns.has("name")) result.missingColumns.push("Nombre");
  if (result.missingColumns.length > 0) return result;

  const get = (row: unknown[], field: Field): string => {
    const index = columns.get(field);
    return index === undefined ? "" : cellText(row[index]);
  };

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const line = i + 1;
    if (row.every((cell) => cellText(cell) === "")) continue;
    // Una fila "Total" u otra sin nombre pero con saldo es de la exportación: se ignora sin molestar.
    const name = get(row, "name");
    if (!name) {
      result.problems.push({ line, message: "Falta el nombre." });
      continue;
    }
    if (name.length > 200) {
      result.problems.push({ line, message: `“${name.slice(0, 40)}…”: el nombre es demasiado largo.` });
      continue;
    }
    const email = get(row, "email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      result.problems.push({ line, message: `“${name}”: el mail “${email}” no parece válido.` });
      continue;
    }
    const invoice = normalizeInvoiceType(get(row, "invoiceType"));
    if (invoice === "invalid") {
      result.problems.push({
        line,
        message: `“${name}”: el tipo de factura “${get(row, "invoiceType")}” no existe (usá Consumidor final, Factura A, B o C).`,
      });
      continue;
    }
    const id = get(row, "id");
    if (id && !UUID.test(id)) {
      result.problems.push({ line, message: `“${name}”: el ID no es válido (no lo cambies de la planilla exportada).` });
      continue;
    }
    result.rows.push({
      line,
      id,
      name,
      razonSocial: get(row, "razonSocial").slice(0, 200),
      phone: get(row, "phone").slice(0, 60),
      email: email.slice(0, 200),
      document: get(row, "document").slice(0, 60),
      invoiceType: invoice,
      notes: get(row, "notes").slice(0, 1000),
    });
  }
  return result;
}

// ---- Coincidencias con los clientes que ya existen ------------------------

export interface KnownCustomer {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
}

const digits = (v: string) => v.replace(/\D/g, "");

export interface CustomerIndex {
  byId: Set<string>;
  byDocument: Map<string, string>;
  byEmail: Map<string, string>;
  byPhone: Map<string, string>;
  /** Nombre normalizado -> id (o null si hay más de uno con ese nombre). */
  byName: Map<string, string | null>;
}

export function buildCustomerIndex(customers: readonly KnownCustomer[]): CustomerIndex {
  const index: CustomerIndex = {
    byId: new Set(),
    byDocument: new Map(),
    byEmail: new Map(),
    byPhone: new Map(),
    byName: new Map(),
  };
  for (const c of customers) {
    index.byId.add(c.id);
    if (c.document && digits(c.document).length >= 6) index.byDocument.set(digits(c.document), c.id);
    if (c.email) index.byEmail.set(c.email.trim().toLowerCase(), c.id);
    if (c.phone && digits(c.phone).length >= 8) index.byPhone.set(digits(c.phone).slice(-10), c.id);
    const n = normalizeText(c.name);
    if (n) index.byName.set(n, index.byName.has(n) ? null : c.id);
  }
  return index;
}

/**
 * A qué cliente existente corresponde una fila: primero por ID de Pesito, y
 * si no, por documento, mail, teléfono y, como último recurso, por nombre
 * (sólo si hay un único cliente con ese nombre). null = es nuevo.
 */
export function matchCustomer(
  row: Pick<CustomerImportRow, "id" | "name" | "document" | "email" | "phone">,
  index: CustomerIndex
): string | null {
  if (row.id && index.byId.has(row.id)) return row.id;
  const doc = digits(row.document);
  if (doc.length >= 6 && index.byDocument.has(doc)) return index.byDocument.get(doc) ?? null;
  if (row.email && index.byEmail.has(row.email.trim().toLowerCase())) {
    return index.byEmail.get(row.email.trim().toLowerCase()) ?? null;
  }
  const phone = digits(row.phone);
  if (phone.length >= 8 && index.byPhone.has(phone.slice(-10))) return index.byPhone.get(phone.slice(-10)) ?? null;
  const byName = index.byName.get(normalizeText(row.name));
  return byName ?? null;
}
