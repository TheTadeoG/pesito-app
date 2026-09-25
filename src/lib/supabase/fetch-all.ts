// Supabase (PostgREST) corta cada respuesta en 1000 filas sin avisar, y
// un `.in("col", ids)` con cientos de ids arma una URL tan larga que el
// servidor la rechaza ("URI too long") — la consulta vuelve con error y
// data null, que el código trataba como "no hay filas". Con un negocio
// mediano (unas 80 ventas por día) eso ya pasaba en Reportes a los pocos
// días: ingresos cortados en 1000 ventas, costo en cero y "Sin ventas" en
// productos más vendidos. Estos helpers traen todo, de a páginas y en
// tandas de ids chicas.

const PAGE_SIZE = 1000;
// ~100 uuids ≈ 3,7 KB de URL: bien por debajo del límite de 8 KB.
const IN_CHUNK_SIZE = 100;
const IN_CONCURRENCY = 4;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Trae todas las filas de una consulta, pidiendo de a `PAGE_SIZE`. La
 * consulta que arma `page` tiene que tener un orden total (terminar en una
 * columna única como `id`) para que las páginas no se pisen ni salteen
 * filas.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/**
 * Como fetchAll, pero para un filtro `.in(col, ids)` con muchos ids: los
 * parte en tandas chicas (y cada tanda también se pagina). `page` recibe la
 * tanda de ids y el rango a pedir.
 */
export async function fetchAllIn<T>(
  ids: readonly string[],
  page: (ids: string[], from: number, to: number) => PageResult<T>
): Promise<T[]> {
  const unique = Array.from(new Set(ids));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + IN_CHUNK_SIZE));
  }

  const rows: T[] = [];
  for (let i = 0; i < chunks.length; i += IN_CONCURRENCY) {
    const results = await Promise.all(
      chunks
        .slice(i, i + IN_CONCURRENCY)
        .map((chunk) => fetchAll((from, to) => page(chunk, from, to)))
    );
    for (const r of results) rows.push(...r);
  }
  return rows;
}
