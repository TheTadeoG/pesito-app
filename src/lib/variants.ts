// Talles y colores (migración 0097): ayudas puras para armar las variantes de un producto.

/** "Remera básica · M · Azul": el nombre de cada variante lleva su talle y color. */
export function variantName(base: string, size: string, color: string): string {
  return [base.trim(), size.trim(), color.trim()].filter(Boolean).join(" · ");
}

/** "Azul marino" -> "AZUL-MARINO" (para armar el SKU de cada variante). */
export function skuPart(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
}

/** SKU sugerido de una variante: el SKU base más su talle y color ("REM-001-M-AZUL"). */
export function variantSku(baseSku: string, size: string, color: string): string {
  return [baseSku.trim(), skuPart(size), skuPart(color)].filter(Boolean).join("-").slice(0, 60);
}

/** Texto separado por comas (o saltos de línea) -> lista sin vacíos ni repetidos (sin distinguir mayúsculas). */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,;\n]/)) {
    const item = part.trim().replace(/\s+/g, " ");
    if (item && !seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase());
      out.push(item);
    }
  }
  return out;
}

/** Todas las combinaciones de talle y color (si falta uno de los dos, sólo el otro). */
export function combinations(sizes: readonly string[], colors: readonly string[]): { size: string; color: string }[] {
  if (sizes.length === 0 && colors.length === 0) return [];
  if (sizes.length === 0) return colors.map((color) => ({ size: "", color }));
  if (colors.length === 0) return sizes.map((size) => ({ size, color: "" }));
  return sizes.flatMap((size) => colors.map((color) => ({ size, color })));
}

/**
 * SKU base de un producto que ya es variante: "REM-001-M-AZUL" con talle M y color Azul -> "REM-001", así las variantes
 * nuevas quedan "REM-001-L-NEGRO" y no "REM-001-M-AZUL-L-NEGRO".
 */
export function baseSkuOf(sku: string, size: string, color: string): string {
  const suffix = [skuPart(size), skuPart(color)].filter(Boolean).join("-");
  if (suffix && sku.toUpperCase().endsWith(`-${suffix}`)) return sku.slice(0, sku.length - suffix.length - 1);
  return sku;
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL"];

/** Talles en orden natural: XS, S, M, L, XL… y los números de menor a mayor; el resto, como vinieron. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (t: string): [number, number] => {
    const up = t.trim().toUpperCase();
    const i = SIZE_ORDER.indexOf(up);
    if (i >= 0) return [0, i];
    const n = Number(up.replace(",", "."));
    if (up !== "" && Number.isFinite(n)) return [1, n];
    return [2, 0];
  };
  return sizes
    .map((t, idx) => ({ t, idx, r: rank(t) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.idx - b.idx)
    .map((x) => x.t);
}
