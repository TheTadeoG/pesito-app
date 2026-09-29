// Carga masiva de productos desde una planilla (Excel o CSV).
//
// Todo esto corre en el navegador: se lee el archivo, se reconocen las
// columnas por su título y se arma la lista de productos para revisar antes
// de guardar. No depende de librerías ni del servidor (se puede probar sola).

export const IMPORT_UNITS = ["u", "kg", "g", "l", "ml", "pack", "caja"] as const;
/** Cuántos productos se guardan por tanda (una llamada al servidor). */
export const IMPORT_CHUNK_SIZE = 250;
/** Tope de filas por archivo: más que el límite de cualquier plan. */
export const IMPORT_MAX_ROWS = 20000;

export interface ImportRow {
  /** Número de fila en la planilla (la 1 es el título), para avisar dónde está un error. */
  line: number;
  name: string;
  barcode: string;
  sku: string;
  brand: string;
  cost: number | null;
  price: number;
  stock: number;
  minStock: number;
  unit: string;
}

export interface ImportProblem {
  line: number;
  message: string;
}

export interface ParsedImport {
  rows: ImportRow[];
  /** Filas que no se pueden importar (con el motivo). */
  problems: ImportProblem[];
  /** Títulos de la planilla que no reconocimos (se ignoran). */
  ignoredColumns: string[];
  /** Columnas obligatorias que faltan: si hay alguna, no se puede importar. */
  missingColumns: string[];
}

type Field = "name" | "barcode" | "sku" | "brand" | "cost" | "price" | "stock" | "minStock" | "unit";

/** Columnas de la planilla modelo, en este orden. */
export const TEMPLATE_COLUMNS: { field: Field; title: string; required?: boolean; example: string | number }[] = [
  { field: "name", title: "Nombre", required: true, example: "Yerba mate 1 kg" },
  { field: "barcode", title: "Código de barras", example: "7790387000012" },
  { field: "sku", title: "SKU", example: "YER-001" },
  { field: "brand", title: "Marca", example: "Taragüí" },
  { field: "cost", title: "Costo", example: 2800 },
  { field: "price", title: "Precio de venta", required: true, example: 4200 },
  { field: "stock", title: "Stock", example: 24 },
  { field: "minStock", title: "Stock mínimo", example: 6 },
  { field: "unit", title: "Unidad", example: "u" },
];

const ALIASES: Record<Field, string[]> = {
  name: ["nombre", "producto", "descripcion", "articulo", "detalle", "nombre del producto"],
  barcode: ["codigo de barras", "codigo barras", "codigo de barra", "ean", "ean13", "cod barras", "barcode", "codigo"],
  sku: ["sku", "codigo interno", "cod interno", "referencia", "ref", "codigo propio"],
  brand: ["marca", "brand"],
  cost: ["costo", "precio de costo", "precio costo", "cost", "costo unitario"],
  price: ["precio", "precio de venta", "precio venta", "pvp", "precio publico", "price", "precio final"],
  stock: ["stock", "cantidad", "existencia", "existencias", "stock actual", "stock inicial"],
  minStock: ["stock minimo", "minimo", "stock min", "min stock", "minimo de stock"],
  unit: ["unidad", "unidad de medida", "medida", "um", "unit"],
};

/** Minúsculas, sin acentos ni signos: "Código de Barras (EAN)" → "codigo de barras ean". */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fieldForHeader(header: unknown): Field | null {
  const text = normalizeText(header);
  if (!text) return null;
  for (const { field } of TEMPLATE_COLUMNS) {
    if (ALIASES[field].includes(text)) return field;
  }
  return null;
}

/**
 * Número escrito a la argentina o a la inglesa: "1.234,50", "1234.5",
 * "$ 1.500", "12,5". Devuelve null si está vacío o no es un número.
 */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "")
    .replace(/[$\s]/g, "")
    .replace(/[^\d.,-]/g, "");
  if (!text || text === "-") return null;
  const hasDot = text.includes(".");
  const hasComma = text.includes(",");
  if (hasDot && hasComma) {
    // El que aparece último es el decimal.
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (hasComma) {
    text = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Texto de una celda: sin espacios sobrantes, y un número entero sin ".0". */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

function normalizeUnit(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return "u";
  const map: Record<string, string> = {
    u: "u", un: "u", unidad: "u", unidades: "u", uni: "u",
    kg: "kg", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
    g: "g", gr: "g", gramo: "g", gramos: "g",
    l: "l", lt: "l", lts: "l", litro: "l", litros: "l",
    ml: "ml", mililitro: "ml", mililitros: "ml", cc: "ml",
    pack: "pack", packs: "pack",
    caja: "caja", cajas: "caja",
  };
  return map[text] ?? null;
}

/**
 * Convierte la planilla (filas de celdas, la primera con los títulos) en la
 * lista de productos a importar. Ignora filas vacías.
 */
export function parseProductSheet(matrix: unknown[][]): ParsedImport {
  const result: ParsedImport = { rows: [], problems: [], ignoredColumns: [], missingColumns: [] };
  if (matrix.length === 0) return result;

  // El título puede no estar en la primera fila (planillas con un encabezado
  // arriba): se toma la primera de las primeras 10 con más columnas reconocidas.
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

  for (const { field, title, required } of TEMPLATE_COLUMNS) {
    if (required && !columns.has(field)) result.missingColumns.push(title);
  }
  if (result.missingColumns.length > 0) return result;

  const get = (row: unknown[], field: Field): unknown => {
    const index = columns.get(field);
    return index === undefined ? undefined : row[index];
  };

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const line = i + 1;
    if (row.every((cell) => cellText(cell) === "")) continue;

    const name = cellText(get(row, "name"));
    if (!name) {
      result.problems.push({ line, message: "Falta el nombre." });
      continue;
    }

    const priceRaw = get(row, "price");
    const price = cellText(priceRaw) === "" ? null : parseNumber(priceRaw);
    if (price === null) {
      result.problems.push({ line, message: `“${name}”: el precio de venta falta o no es un número.` });
      continue;
    }
    if (price < 0) {
      result.problems.push({ line, message: `“${name}”: el precio no puede ser negativo.` });
      continue;
    }

    const costRaw = get(row, "cost");
    const cost = cellText(costRaw) === "" ? null : parseNumber(costRaw);
    if (cellText(costRaw) !== "" && (cost === null || cost < 0)) {
      result.problems.push({ line, message: `“${name}”: el costo no es un número válido.` });
      continue;
    }

    const stockRaw = get(row, "stock");
    const stock = cellText(stockRaw) === "" ? 0 : parseNumber(stockRaw);
    if (stock === null || stock < 0) {
      result.problems.push({ line, message: `“${name}”: el stock no es un número válido.` });
      continue;
    }

    const minRaw = get(row, "minStock");
    const minStock = cellText(minRaw) === "" ? 0 : parseNumber(minRaw);
    if (minStock === null || minStock < 0) {
      result.problems.push({ line, message: `“${name}”: el stock mínimo no es un número válido.` });
      continue;
    }

    const unit = normalizeUnit(get(row, "unit"));
    if (unit === null) {
      result.problems.push({
        line,
        message: `“${name}”: la unidad “${cellText(get(row, "unit"))}” no existe (usá unidad, kg, g, l, ml, pack o caja).`,
      });
      continue;
    }

    result.rows.push({
      line,
      name,
      barcode: cellText(get(row, "barcode")),
      sku: cellText(get(row, "sku")),
      brand: cellText(get(row, "brand")),
      cost,
      price,
      stock,
      minStock,
      unit,
    });
  }

  return result;
}

/** Lee un CSV (coma, punto y coma o tabulación; con comillas). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","]
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
