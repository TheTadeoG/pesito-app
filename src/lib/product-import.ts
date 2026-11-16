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

/** Datos de un producto que ya existe que la carga puede actualizar (el stock nunca: sólo se mueve con ventas, compras y ajustes). */
export type UpdateField = "price" | "cost" | "brand" | "supplier" | "name" | "minStock" | "unit" | "barcode";

export const UPDATE_FIELDS: { field: UpdateField; label: string; hint: string; defaultOn: boolean }[] = [
  { field: "price", label: "Precio de venta", hint: "Se reemplaza por el de la planilla.", defaultOn: true },
  { field: "cost", label: "Costo", hint: "Si la celda está vacía, se deja el costo actual.", defaultOn: true },
  { field: "brand", label: "Marca", hint: "Si la celda está vacía, se deja la marca actual.", defaultOn: true },
  { field: "supplier", label: "Proveedor", hint: "Si la celda está vacía, se deja el proveedor actual. Si no existe, se crea.", defaultOn: true },
  { field: "name", label: "Nombre", hint: "Cambia el nombre del producto.", defaultOn: false },
  { field: "minStock", label: "Stock mínimo", hint: "Cambia el aviso de reposición.", defaultOn: false },
  { field: "unit", label: "Unidad", hint: "Unidad, kg, litro, etc.", defaultOn: false },
  { field: "barcode", label: "Código de barras", hint: "Si la celda está vacía, se deja el actual.", defaultOn: false },
];

export interface ImportRow {
  /** Número de fila en la planilla (la 1 es el título), para avisar dónde está un error. */
  line: number;
  name: string;
  barcode: string;
  sku: string;
  brand: string;
  supplier: string;
  cost: number | null;
  /** Precio efectivo: el de la planilla, o el calculado con el costo y el % de ganancia. */
  price: number;
  /** Lo que decía la celda de precio (null si estaba vacía) y la de % de ganancia. Sirven para saber qué se editó. */
  sheetPrice: number | null;
  markup: number | null;
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

type Field = "name" | "barcode" | "sku" | "brand" | "supplier" | "cost" | "price" | "markup" | "stock" | "minStock" | "unit";

/** Columnas de la planilla modelo, en este orden. */
export const TEMPLATE_COLUMNS: { field: Field; title: string; required?: boolean; example: string | number }[] = [
  { field: "name", title: "Nombre", required: true, example: "Yerba mate 1 kg" },
  { field: "sku", title: "SKU", required: true, example: "YER-001" },
  { field: "barcode", title: "Código de barras", example: "7790387000012" },
  { field: "brand", title: "Marca", example: "Taragüí" },
  { field: "supplier", title: "Proveedor", example: "Distribuidora Norte" },
  { field: "cost", title: "Costo", example: 2800 },
  { field: "price", title: "Precio de venta", example: 4200 },
  // Alternativa al precio: con costo y este %, el precio se calcula solo (si ya hay precio, se usa el precio).
  { field: "markup", title: "Ganancia sobre el costo (%)", example: 50 },
  { field: "stock", title: "Stock", example: 24 },
  { field: "minStock", title: "Stock mínimo", example: 6 },
  { field: "unit", title: "Unidad", example: "u" },
];

const ALIASES: Record<Field, string[]> = {
  name: ["nombre", "producto", "descripcion", "articulo", "detalle", "nombre del producto"],
  barcode: ["codigo de barras", "codigo barras", "codigo de barra", "ean", "ean13", "cod barras", "barcode", "codigo"],
  sku: ["sku", "codigo interno", "cod interno", "referencia", "ref", "codigo propio"],
  brand: ["marca", "brand"],
  supplier: ["proveedor", "distribuidor", "supplier"],
  cost: ["costo", "precio de costo", "precio costo", "cost", "costo unitario"],
  price: ["precio", "precio de venta", "precio venta", "pvp", "precio publico", "price", "precio final"],
  markup: ["ganancia sobre el costo", "ganancia sobre costo", "ganancia", "margen", "markup", "porcentaje de ganancia", "recargo"],
  stock: ["stock", "cantidad", "existencia", "existencias", "stock actual", "stock inicial"],
  minStock: ["stock minimo", "minimo", "stock min", "min stock", "minimo de stock"],
  unit: ["unidad", "unidad de medida", "medida", "um", "unit"],
};

/** Columnas de la planilla que se baja de Pesito y son sólo informativas: al volver a subirla se ignoran sin avisar. */
const INFO_COLUMNS = ["falta para el minimo", "alcanza para dias", "estado", "valor al costo"];

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
    else if (!field && cellText(header) && !INFO_COLUMNS.includes(normalizeText(header))) result.ignoredColumns.push(cellText(header));
  });

  for (const { field, title, required } of TEMPLATE_COLUMNS) {
    if (required && !columns.has(field)) result.missingColumns.push(title);
  }
  // El precio de venta puede venir directo o calcularse con el costo y el % de ganancia.
  if (!columns.has("price") && !columns.has("markup")) result.missingColumns.push("Precio de venta");
  if (result.missingColumns.length > 0) return result;

  const get = (row: unknown[], field: Field): unknown => {
    const index = columns.get(field);
    return index === undefined ? undefined : row[index];
  };

  const seenSkus = new Set<string>();
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const line = i + 1;
    if (row.every((cell) => cellText(cell) === "")) continue;

    const name = cellText(get(row, "name"));
    if (!name) {
      result.problems.push({ line, message: "Falta el nombre." });
      continue;
    }

    const costRaw = get(row, "cost");
    const cost = cellText(costRaw) === "" ? null : parseNumber(costRaw);
    if (cellText(costRaw) !== "" && (cost === null || cost < 0)) {
      result.problems.push({ line, message: `“${name}”: el costo no es un número válido.` });
      continue;
    }

    // Precio: el de la planilla; si falta, costo + % de ganancia sobre el costo.
    const sku = cellText(get(row, "sku"));
    if (!sku) {
      result.problems.push({ line, message: `“${name}”: falta el SKU (el código propio que identifica al producto).` });
      continue;
    }
    if (sku.length > 60) {
      result.problems.push({ line, message: `“${name}”: el SKU es demasiado largo (máximo 60 caracteres).` });
      continue;
    }
    if (seenSkus.has(sku.toLowerCase())) {
      result.problems.push({ line, message: `“${name}”: el SKU ${sku} está repetido en la planilla (se carga la primera vez).` });
      continue;
    }
    seenSkus.add(sku.toLowerCase());

    const priceRaw = get(row, "price");
    const markupRaw = get(row, "markup");
    let price = cellText(priceRaw) === "" ? null : parseNumber(priceRaw);
    if (price === null && cellText(priceRaw) === "" && cellText(markupRaw) !== "") {
      const markup = parseNumber(markupRaw);
      if (markup === null || markup <= -100) {
        result.problems.push({ line, message: `“${name}”: la ganancia sobre el costo no es un número válido.` });
        continue;
      }
      if (cost === null || cost <= 0) {
        result.problems.push({ line, message: `“${name}”: para calcular el precio con el % de ganancia hace falta el costo.` });
        continue;
      }
      price = Math.round(cost * (1 + markup / 100) * 100) / 100;
    }
    if (price === null) {
      result.problems.push({ line, message: `“${name}”: falta el precio de venta (o el costo y el % de ganancia).` });
      continue;
    }
    if (price < 0) {
      result.problems.push({ line, message: `“${name}”: el precio no puede ser negativo.` });
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
      sku,
      brand: cellText(get(row, "brand")),
      supplier: cellText(get(row, "supplier")),
      cost,
      price,
      sheetPrice: cellText(priceRaw) === "" ? null : parseNumber(priceRaw),
      markup: cellText(markupRaw) === "" ? null : parseNumber(markupRaw),
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

/**
 * Precio de un producto que ya existe cuando la planilla trae precio y % de ganancia (por ejemplo, la que se baja de
 * Pesito y se vuelve a subir): lo que se editó es lo que manda.
 *  - Si el precio cambió respecto del que tiene el producto, vale el precio.
 *  - Si no, y el % ya no coincide con el que daba el precio y costo actuales, vale el % (sobre el costo de la planilla,
 *    o el actual si no vino).
 *  - Si nada cambió, el precio queda igual (editar sólo el costo no mueve el precio).
 */
export function resolveExistingPrice(row: ImportRow, current: { price: number; cost: number | null }): number {
  if (row.sheetPrice !== null && Math.abs(row.sheetPrice - current.price) > 0.005) return row.sheetPrice;
  if (row.markup !== null && current.cost !== null && current.cost > 0) {
    const was = (current.price / current.cost - 1) * 100;
    const basis = row.cost !== null && row.cost > 0 ? row.cost : current.cost;
    if (Math.abs(row.markup - was) > 0.06 && row.markup > -100) return Math.round(basis * (1 + row.markup / 100) * 100) / 100;
  }
  return row.sheetPrice ?? row.price;
}

/**
 * Productos existentes por SKU (lo que identifica a cada producto: obligatorio y único en el negocio, sin importar
 * mayúsculas ni espacios al borde).
 */
export function makeProductMatcher<T extends { sku: string; barcode: string | null }>(products: readonly T[]) {
  const bySku = new Map<string, T>();
  const byBarcode = new Map<string, T>();
  for (const p of products) {
    if (p.sku) bySku.set(p.sku.trim().toLowerCase(), p);
    if (p.barcode) byBarcode.set(p.barcode.trim().toLowerCase(), p);
  }
  return {
    find(row: { sku: string }): T | null {
      return bySku.get(row.sku.trim().toLowerCase()) ?? null;
    },
    /** Producto que ya usa ese código de barras (para no pisarlo al actualizar otro). */
    barcodeOwner: (code: string) => byBarcode.get(code.trim().toLowerCase()) ?? null,
  };
}
