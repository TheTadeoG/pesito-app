// Carga masiva de proveedores desde una planilla (Excel o CSV). Corre en el navegador (se puede probar sola):
// reconoce las columnas por su título y arma la lista para revisar antes de guardar.
import { normalizeText, parseNumber } from "@/lib/product-import";

export const SUPPLIER_IMPORT_MAX_ROWS = 2000;

export interface SupplierImportRow {
  line: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
  /** Días que tarda en llegar un pedido (opcional). */
  leadTimeDays: number | null;
}

export interface SupplierImportProblem {
  line: number;
  message: string;
}

export interface ParsedSupplierImport {
  rows: SupplierImportRow[];
  problems: SupplierImportProblem[];
  ignoredColumns: string[];
  missingColumns: string[];
}

type Field = "name" | "phone" | "email" | "notes" | "leadTimeDays";

/** Columnas de la planilla modelo, en este orden. */
export const SUPPLIER_TEMPLATE_COLUMNS: { field: Field; title: string; required?: boolean; example: string | number }[] = [
  { field: "name", title: "Nombre", required: true, example: "Distribuidora Norte" },
  { field: "phone", title: "Teléfono", example: "11 5555 1234" },
  { field: "email", title: "Email", example: "pedidos@distribuidora.com" },
  { field: "notes", title: "Notas", example: "Pasa los martes" },
  { field: "leadTimeDays", title: "Plazo de entrega (días)", example: 2 },
];

const ALIASES: Record<Field, string[]> = {
  name: ["nombre", "proveedor", "razon social", "empresa", "nombre del proveedor"],
  phone: ["telefono", "tel", "celular", "whatsapp", "phone"],
  email: ["email", "mail", "correo", "e mail", "correo electronico"],
  notes: ["notas", "nota", "observaciones", "comentarios", "detalle"],
  leadTimeDays: ["plazo de entrega dias", "plazo de entrega", "dias de entrega", "demora", "lead time"],
};

function fieldForHeader(header: unknown): Field | null {
  const text = normalizeText(header);
  if (!text) return null;
  for (const { field } of SUPPLIER_TEMPLATE_COLUMNS) if (ALIASES[field].includes(text)) return field;
  return null;
}

const cellText = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "number" ? String(v) : String(v).trim());

export function parseSupplierSheet(matrix: unknown[][]): ParsedSupplierImport {
  const result: ParsedSupplierImport = { rows: [], problems: [], ignoredColumns: [], missingColumns: [] };
  if (matrix.length === 0) return result;

  let headerIndex = 0;
  let best = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const recognized = matrix[i].filter((h) => fieldForHeader(h)).length;
    if (recognized > best) {
      best = recognized;
      headerIndex = i;
    }
  }
  const columns = new Map<Field, number>();
  matrix[headerIndex].forEach((header, index) => {
    const field = fieldForHeader(header);
    if (field && !columns.has(field)) columns.set(field, index);
    else if (!field && cellText(header)) result.ignoredColumns.push(cellText(header));
  });
  for (const { field, title, required } of SUPPLIER_TEMPLATE_COLUMNS) {
    if (required && !columns.has(field)) result.missingColumns.push(title);
  }
  if (result.missingColumns.length > 0) return result;
  const get = (row: unknown[], field: Field): unknown => {
    const i = columns.get(field);
    return i === undefined ? undefined : row[i];
  };

  const seen = new Set<string>();
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const line = i + 1;
    if (row.every((c) => cellText(c) === "")) continue;
    const name = cellText(get(row, "name"));
    if (!name) {
      result.problems.push({ line, message: "Falta el nombre." });
      continue;
    }
    if (name.length > 120) {
      result.problems.push({ line, message: `“${name.slice(0, 30)}…”: el nombre es demasiado largo.` });
      continue;
    }
    const key = normalizeText(name);
    if (seen.has(key)) {
      result.problems.push({ line, message: `“${name}”: está repetido en la planilla (se carga la primera vez).` });
      continue;
    }
    seen.add(key);
    const email = cellText(get(row, "email"));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      result.problems.push({ line, message: `“${name}”: el email no es válido.` });
      continue;
    }
    const leadRaw = get(row, "leadTimeDays");
    const lead = cellText(leadRaw) === "" ? null : parseNumber(leadRaw);
    if (cellText(leadRaw) !== "" && (lead === null || !Number.isInteger(lead) || lead < 0 || lead > 90)) {
      result.problems.push({ line, message: `“${name}”: el plazo de entrega tiene que ser un número de días entre 0 y 90.` });
      continue;
    }
    result.rows.push({ line, name, phone: cellText(get(row, "phone")).slice(0, 40), email, notes: cellText(get(row, "notes")).slice(0, 500), leadTimeDays: lead });
  }
  return result;
}
