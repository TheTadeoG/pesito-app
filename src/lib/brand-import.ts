// Carga masiva de marcas desde una planilla (Excel o CSV): una columna con el nombre. Corre en el navegador.
import { normalizeText } from "@/lib/product-import";

export const BRAND_IMPORT_MAX_ROWS = 2000;

export interface BrandImportRow {
  line: number;
  name: string;
}
export interface ParsedBrandImport {
  rows: BrandImportRow[];
  problems: { line: number; message: string }[];
  ignoredColumns: string[];
  missingColumns: string[];
}

export const BRAND_TEMPLATE_TITLE = "Nombre";
const ALIASES = ["nombre", "marca", "marcas", "nombre de la marca", "brand"];

export function parseBrandSheet(matrix: unknown[][]): ParsedBrandImport {
  const result: ParsedBrandImport = { rows: [], problems: [], ignoredColumns: [], missingColumns: [] };
  if (matrix.length === 0) return result;
  const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

  let headerIndex = 0;
  let col = -1;
  for (let i = 0; i < Math.min(matrix.length, 10) && col < 0; i++) {
    const c = matrix[i].findIndex((h) => ALIASES.includes(normalizeText(h)));
    if (c >= 0) {
      headerIndex = i;
      col = c;
    }
  }
  if (col < 0) {
    result.missingColumns.push(BRAND_TEMPLATE_TITLE);
    return result;
  }
  matrix[headerIndex].forEach((h, i) => {
    if (i !== col && text(h)) result.ignoredColumns.push(text(h));
  });

  const seen = new Set<string>();
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const line = i + 1;
    const name = text(matrix[i][col]);
    if (!name) {
      if (matrix[i].some((c) => text(c) !== "")) result.problems.push({ line, message: "Falta el nombre." });
      continue;
    }
    if (name.length > 80) {
      result.problems.push({ line, message: `“${name.slice(0, 30)}…”: el nombre es demasiado largo.` });
      continue;
    }
    const key = normalizeText(name);
    if (seen.has(key)) {
      result.problems.push({ line, message: `“${name}”: está repetida en la planilla (se carga la primera vez).` });
      continue;
    }
    seen.add(key);
    result.rows.push({ line, name });
  }
  return result;
}
