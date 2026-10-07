// Mezcla de la copia local del catálogo del POS con lo que devuelve la base.
// Sin imports ni efectos: se prueba sola (src/lib/pos-catalog-merge.test.mts).
//
// Regla de oro: ante cualquier cosa que no cuadre devuelve null y el llamador
// baja el catálogo completo. Nunca se arma una lista "casi bien".

export interface CatalogItem {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  price: number;
  stock: number;
  min_stock: number;
  unit: string;
  image_url: string | null;
}

/** Fila de `changed` de pos_catalog / pos_catalog_delta. */
export interface ChangedRow {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  price: number | string;
  min_stock: number | string;
  unit: string;
  image_url: string | null;
  active: boolean;
}

export type StockPairs = [string, number | string][];

const collator = new Intl.Collator("es");
const byName = (a: { name: string }, b: { name: string }) => collator.compare(a.name, b.name);

const finite = (value: number | string): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function toItem(row: ChangedRow, stock: number): CatalogItem | null {
  const price = finite(row.price);
  const minStock = finite(row.min_stock);
  if (typeof row.id !== "string" || typeof row.name !== "string" || price === null || minStock === null) return null;
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode ?? null,
    sku: row.sku ?? null,
    price,
    stock,
    min_stock: minStock,
    unit: row.unit,
    image_url: row.image_url ?? null,
  };
}

/**
 * Respuesta COMPLETA (pos_catalog): `stock` es la lista oficial de productos
 * activos. Cada uno tiene que tener sus datos en `base` o en `changed`.
 */
export function mergeFull(base: CatalogItem[], changed: ChangedRow[], stock: StockPairs): CatalogItem[] | null {
  const details = new Map(base.map((p) => [p.id, p]));
  for (const row of changed) {
    if (!row.active) {
      details.delete(row.id);
      continue;
    }
    const item = toItem(row, details.get(row.id)?.stock ?? 0);
    if (!item) return null;
    details.set(row.id, item);
  }
  const out: CatalogItem[] = [];
  const seen = new Set<string>();
  for (const [id, rawStock] of stock) {
    const stockValue = finite(rawStock);
    const item = details.get(id);
    if (!item || stockValue === null || seen.has(id)) return null;
    seen.add(id);
    out.push({ ...item, stock: stockValue });
  }
  return out.sort(byName);
}

/**
 * Respuesta DELTA (pos_catalog_delta): `changed` y `stock` traen sólo lo que
 * cambió; `activeCount` es cuántos productos activos hay en total. Si después
 * de mezclar no da esa cantidad, algo se perdió (un producto borrado, un
 * cambio que no llegó): se devuelve null.
 */
export function mergeDelta(
  base: CatalogItem[],
  changed: ChangedRow[],
  stock: StockPairs,
  activeCount: number
): CatalogItem[] | null {
  if (!Number.isInteger(activeCount) || activeCount < 0) return null;
  const map = new Map(base.map((p) => [p.id, p]));
  const needsStock = new Set<string>();
  for (const row of changed) {
    if (!row.active) {
      map.delete(row.id);
      needsStock.delete(row.id);
      continue;
    }
    const known = map.get(row.id);
    const item = toItem(row, known?.stock ?? 0);
    if (!item) return null;
    map.set(row.id, item);
    // Un producto cambiado tiene que traer también su stock actual.
    needsStock.add(row.id);
  }
  for (const [id, rawStock] of stock) {
    const stockValue = finite(rawStock);
    const item = map.get(id);
    if (!item || stockValue === null) return null;
    map.set(id, { ...item, stock: stockValue });
    needsStock.delete(id);
  }
  if (needsStock.size > 0) return null;
  if (map.size !== activeCount) return null;
  return Array.from(map.values()).sort(byName);
}
