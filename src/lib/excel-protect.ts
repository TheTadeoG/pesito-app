// Protege las planillas que se pueden volver a subir: bloquea los títulos, los datos que no se deben tocar y las hojas de
// ayuda, y deja libres las celdas que sí se completan (también las filas nuevas de esas columnas).
//
// Es una protección de hoja SIN contraseña: evita cambios por descuido (Excel avisa que la celda está protegida) pero
// quien quiera puede quitarla desde Revisar → Desproteger hoja. No es una medida de seguridad: el servidor valida igual.
//
// write-excel-file no sabe de protección, así que se retoca el .xlsx ya armado (un zip de XML): se agrega
// <sheetProtection> a cada hoja y se clonan los estilos de las celdas libres con <protection locked="0"/>.

import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

export interface SheetProtection {
  /** Columnas (0 = A) que se pueden editar, también en filas existentes. */
  editable?: readonly number[];
  /**
   * Columnas que identifican a la fila (SKU, nombre...): en las filas que ya están quedan bloqueadas, pero en las filas
   * nuevas se pueden completar.
   */
  keys?: readonly number[];
  /** Filas de títulos de arriba (siempre bloqueadas). Por defecto 1. */
  headerRows?: number;
}

/** Hoja entera bloqueada (por ejemplo la de ayuda). */
export const LOCKED_SHEET: SheetProtection = {};

/** Todas las columnas editables, menos los títulos. */
export function allColumnsEditable(count: number): SheetProtection {
  return { editable: Array.from({ length: count }, (_, i) => i) };
}

function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Aplica la protección a un .xlsx (en el orden de las hojas). Devuelve el archivo nuevo. */
export function protectXlsx(data: Uint8Array, sheets: readonly SheetProtection[]): Uint8Array {
  const files = unzipSync(data);
  const stylesPath = "xl/styles.xml";
  let styles = strFromU8(files[stylesPath]);

  const block = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(styles);
  if (!block) throw new Error("La planilla no tiene estilos de celda.");
  const xfs = [...block[1].matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => m[0]);
  const unlockedOf = new Map<number, number>();

  /** Copia de un estilo con la celda desbloqueada. */
  function unlocked(styleId: number): number {
    const cached = unlockedOf.get(styleId);
    if (cached !== undefined) return cached;
    const base = xfs[styleId] ?? xfs[0] ?? "<xf></xf>";
    const parts = /^<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)$/.exec(base);
    const attrs = (parts?.[1] ?? "").replace(/\s*applyProtection="[^"]*"/, "");
    const inner = (parts?.[2] ?? "").replace(/<protection\b[^>]*\/>/, "");
    const clone = `<xf${attrs} applyProtection="1">${inner}<protection locked="0"/></xf>`;
    xfs.push(clone);
    unlockedOf.set(styleId, xfs.length - 1);
    return xfs.length - 1;
  }

  sheets.forEach((rule, i) => {
    const path = `xl/worksheets/sheet${i + 1}.xml`;
    if (!files[path]) return;
    let xml = strFromU8(files[path]);
    const editable = new Set(rule.editable ?? []);
    const keys = new Set(rule.keys ?? []);
    const headerRows = rule.headerRows ?? 1;

    if (editable.size > 0 || keys.size > 0) {
      // Celdas existentes: se desbloquean las de columnas editables (fuera de los títulos).
      xml = xml.replace(/<c r="([A-Z]+)(\d+)"((?: s="\d+")?)/g, (whole, col: string, row: string, s: string) => {
        const c = columnIndex(col);
        if (Number(row) > headerRows && keys.has(c) && !editable.has(c)) {
          // Columna clave: las filas que ya están quedan bloqueadas aunque la columna sea libre para filas nuevas
          // (se fija el estilo explícito para que ningún programa lo herede de la columna).
          return `<c r="${col}${row}" s="${s ? /\d+/.exec(s)?.[0] : 0}"`;
        }
        if (Number(row) <= headerRows || !editable.has(c)) return whole;
        const id = unlocked(s ? Number(/\d+/.exec(s)?.[0]) : 0);
        return `<c r="${col}${row}" s="${id}"`;
      });
      // Columnas libres para filas nuevas (celdas que todavía no existen): editables y claves.
      xml = xml.replace(/<col\b([^>]*?)\/>/g, (whole, attrs: string) => {
        const min = Number(/min="(\d+)"/.exec(attrs)?.[1] ?? 0);
        const max = Number(/max="(\d+)"/.exec(attrs)?.[1] ?? 0);
        let free = false;
        for (let c = min; c <= max; c++) if (editable.has(c - 1) || keys.has(c - 1)) free = true;
        if (!free || /\sstyle="/.test(attrs)) return whole;
        return `<col${attrs} style="${unlocked(0)}"/>`;
      });
    }

    // Hoja protegida sin contraseña; se permite ajustar el ancho y el alto de columnas y filas.
    xml = xml.replace(
      "</sheetData>",
      '</sheetData><sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0" insertRows="0" deleteRows="0"/>'
    );
    files[path] = strToU8(xml);
  });

  styles = styles.replace(block[0], `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>`);
  files[stylesPath] = strToU8(styles);
  return zipSync(files);
}

type Sheets = Parameters<(typeof import("write-excel-file/browser"))["default"]>[0];

/**
 * Arma el .xlsx, le aplica la protección y lo descarga. Reemplaza a `writeXlsxFile(...).toFile(nombre)` en las planillas
 * que se pueden volver a subir.
 */
export async function saveProtectedXlsx(sheets: Sheets, fileName: string, protection: readonly SheetProtection[]): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const blob: Blob = await writeXlsxFile(sheets).toBlob();
  const bytes = protectXlsx(new Uint8Array(await blob.arrayBuffer()), protection);
  const file = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
