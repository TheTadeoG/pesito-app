// Precios de supermercados por EAN: consulta a cada súper, lectura de la respuesta y cuentas para
// comparar con el precio propio. Sin dependencias del panel (lo usan el cron y las pantallas).
// Cada súper de la lista usa VTEX, que tiene una consulta pública por código de barras.

export interface MarketStore {
  id: string;
  label: string;
  host: string;
}

export const MARKET_STORES: MarketStore[] = [
  { id: "carrefour", label: "Carrefour", host: "www.carrefour.com.ar" },
  { id: "jumbo", label: "Jumbo", host: "www.jumbo.com.ar" },
  { id: "disco", label: "Disco", host: "www.disco.com.ar" },
  { id: "vea", label: "Vea", host: "www.vea.com.ar" },
];

export const storeLabel = (id: string) => MARKET_STORES.find((s) => s.id === id)?.label ?? id;

/** Sólo dígitos y largo de código de barras (EAN-8, UPC-12, EAN-13, GTIN-14); si no, null. */
export function normalizeEan(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits) ? digits : null;
}

export interface StorePrice {
  price: number;
  listPrice: number | null;
  name: string | null;
  brand: string | null;
  url: string | null;
  imageUrl: string | null;
  available: boolean;
}

interface VtexOffer {
  Price?: number;
  ListPrice?: number;
  AvailableQuantity?: number;
}
interface VtexItem {
  ean?: string;
  images?: { imageUrl?: string }[];
  sellers?: { commertialOffer?: VtexOffer }[];
}
interface VtexProduct {
  productName?: string;
  brand?: string;
  link?: string;
  items?: VtexItem[];
}

/**
 * Lee la respuesta de `/api/catalog_system/pub/products/search?fq=alternateIds_Ean:<ean>`.
 * Toma la presentación cuyo EAN coincide y la primera oferta con precio; null si no hay.
 */
export function parseVtexProducts(json: unknown, ean: string): StorePrice | null {
  if (!Array.isArray(json)) return null;
  for (const product of json as VtexProduct[]) {
    for (const item of product.items ?? []) {
      if (item.ean && item.ean !== ean) continue;
      const offer = (item.sellers ?? []).map((s) => s.commertialOffer).find((o) => o && Number(o.Price) > 0);
      if (!offer) continue;
      const price = Number(offer.Price);
      const list = Number(offer.ListPrice);
      return {
        price: Math.round(price * 100) / 100,
        listPrice: list > 0 ? Math.round(list * 100) / 100 : null,
        name: product.productName?.slice(0, 200) ?? null,
        brand: product.brand?.slice(0, 80) ?? null,
        url: product.link?.slice(0, 300) ?? null,
        imageUrl: item.images?.[0]?.imageUrl?.slice(0, 300) ?? null,
        available: Number(offer.AvailableQuantity ?? 1) > 0,
      };
    }
  }
  return null;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** Precio de un EAN en un súper. `null` = el súper no lo tiene; tira error si no se pudo preguntar. */
export async function fetchStorePrice(store: MarketStore, ean: string, fetchImpl: FetchLike = fetch as FetchLike): Promise<StorePrice | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetchImpl(`https://${store.host}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; PesitoPrecios/1.0; +https://www.pesito.com.ar)" },
      signal: controller.signal,
    });
    // 404 / 206 sin resultados: el súper no lo tiene. Otros errores (429, 5xx): se reintenta otro día.
    if (res.status === 404) return null;
    if (!res.ok && res.status !== 206) throw new Error(`${store.id} respondió ${res.status}`);
    return parseVtexProducts(await res.json(), ean);
  } finally {
    clearTimeout(timer);
  }
}

export interface PriceStats {
  min: number;
  max: number;
  median: number;
  stores: number;
}

export function priceStats(prices: number[]): PriceStats | null {
  const p = prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (p.length === 0) return null;
  const mid = Math.floor(p.length / 2);
  const median = p.length % 2 ? p[mid] : (p[mid - 1] + p[mid]) / 2;
  return { min: p[0], max: p[p.length - 1], median: Math.round(median * 100) / 100, stores: p.length };
}

export type PricePosition = "muy-barato" | "barato" | "en-rango" | "caro" | "muy-caro";

export interface PositionLimits {
  /** Avisar "caro" si estás más de X % por encima de la mediana de los súper. */
  highPct: number;
  /** Avisar "barato" si estás más de X % por debajo. */
  lowPct: number;
}

export const DEFAULT_POSITION_LIMITS: PositionLimits = { highPct: 20, lowPct: 15 };

/** Diferencia en % contra la mediana de los súper (positivo = más caro que ellos). */
export function diffPct(myPrice: number, stats: PriceStats): number {
  return Math.round(((myPrice - stats.median) / stats.median) * 1000) / 10;
}

export function pricePosition(myPrice: number, stats: PriceStats, limits: PositionLimits = DEFAULT_POSITION_LIMITS): PricePosition {
  const d = diffPct(myPrice, stats);
  if (d > limits.highPct * 1.5) return "muy-caro";
  if (d > limits.highPct) return "caro";
  if (d < -limits.lowPct * 1.5) return "muy-barato";
  if (d < -limits.lowPct) return "barato";
  return "en-rango";
}

export const positionLabels: Record<PricePosition, string> = {
  "muy-barato": "Muy barato",
  barato: "Barato",
  "en-rango": "En rango",
  caro: "Caro",
  "muy-caro": "Muy caro",
};

/** Redondea a un precio "de góndola": múltiplos de 10 (hasta $2.000) o de 50. */
export function roundShelfPrice(n: number): number {
  const step = n >= 2000 ? 50 : 10;
  return Math.max(step, Math.round(n / step) * step);
}

export interface PriceSuggestion {
  price: number;
  /** Por qué ese número, en una frase. */
  reason: string;
}

/**
 * Precio sugerido a partir de los súper: apenas por debajo de la mediana (los súper hacen precio,
 * un negocio de barrio compite por cercanía y no por ser más caro). Nunca por debajo del costo con
 * `minMarginPct` de ganancia, si se conoce el costo.
 */
export function suggestPrice(stats: PriceStats, cost: number | null, minMarginPct = 10): PriceSuggestion {
  const base = roundShelfPrice(stats.median * 0.97);
  if (cost && cost > 0) {
    const floor = roundShelfPrice(cost * (1 + minMarginPct / 100));
    if (base < floor) {
      return { price: floor, reason: `Los súper están en $${Math.round(stats.median)}, pero con tu costo necesitás al menos ${minMarginPct}% de ganancia.` };
    }
  }
  return { price: base, reason: `Apenas por debajo de la mediana de los súper ($${Math.round(stats.median)}, entre $${Math.round(stats.min)} y $${Math.round(stats.max)}).` };
}

/** Días del mes en que el cron todavía puede estar juntando precios. */
const SCAN_DAYS = 11;
const SCAN_TTL_MS = 60 * 60 * 1000;

/** Hasta cuándo sirve lo guardado en `at`. */
export function cacheValidUntil(at: number): number {
  const d = new Date(at);
  if (d.getUTCDate() <= SCAN_DAYS) return at + SCAN_TTL_MS;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

// --- Catálogo completo de cada súper (para buscar por nombre) ---------------------------------

export interface CatalogItem extends StorePrice {
  ean: string;
}

export interface CrawlCategory {
  /** Ruta de ids para filtrar: "12/45/301". */
  path: string;
  name: string;
}

interface VtexCategoryNode {
  id?: number;
  name?: string;
  children?: VtexCategoryNode[];
}

/** Categorías "hoja" del árbol de VTEX (`/api/catalog_system/pub/category/tree/<n>`), con su ruta de ids. */
export function leafCategories(tree: unknown): CrawlCategory[] {
  const out: CrawlCategory[] = [];
  const walk = (nodes: VtexCategoryNode[], path: string[]) => {
    for (const n of nodes) {
      if (typeof n.id !== "number") continue;
      const here = [...path, String(n.id)];
      if (n.children && n.children.length > 0) walk(n.children, here);
      else out.push({ path: here.join("/"), name: String(n.name ?? "").slice(0, 100) });
    }
  };
  if (Array.isArray(tree)) walk(tree as VtexCategoryNode[], []);
  return out;
}

export const CRAWL_PAGE_SIZE = 50;
/** VTEX no devuelve más de 2.500 resultados por consulta. */
export const CRAWL_MAX_FROM = 2450;

export function categoryPageUrl(store: MarketStore, categoryPath: string, from: number): string {
  const to = from + CRAWL_PAGE_SIZE - 1;
  return `https://${store.host}/api/catalog_system/pub/products/search?fq=C:/${categoryPath}/&_from=${from}&_to=${to}`;
}

/** Todas las presentaciones con código de barras y precio de una página de resultados. */
export function parseVtexCatalogPage(json: unknown): { items: CatalogItem[]; products: number } {
  if (!Array.isArray(json)) return { items: [], products: 0 };
  const items: CatalogItem[] = [];
  for (const product of json as (VtexProduct & { items?: (VtexItem & { nameComplete?: string })[] })[]) {
    for (const item of product.items ?? []) {
      const ean = normalizeEan(item.ean);
      if (!ean) continue;
      const offer = (item.sellers ?? []).map((s) => s.commertialOffer).find((o) => o && Number(o.Price) > 0);
      if (!offer) continue;
      const list = Number(offer.ListPrice);
      items.push({
        ean,
        price: Math.round(Number(offer.Price) * 100) / 100,
        listPrice: list > 0 ? Math.round(list * 100) / 100 : null,
        name: (item.nameComplete ?? product.productName ?? "").slice(0, 200) || null,
        brand: product.brand?.slice(0, 80) ?? null,
        url: product.link?.slice(0, 300) ?? null,
        imageUrl: item.images?.[0]?.imageUrl?.slice(0, 300) ?? null,
        available: Number(offer.AvailableQuantity ?? 1) > 0,
      });
    }
  }
  return { items, products: (json as unknown[]).length };
}

/** Un mismo código puede venir repetido en una página: queda el primero. */
export function dedupeByEan(items: CatalogItem[]): CatalogItem[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.ean) ? false : (seen.add(i.ean), true)));
}

/** Una consulta de catálogo (árbol o página). Mismo criterio de errores que fetchStorePrice. */
export async function fetchJson(url: string, fetchImpl: FetchLike = fetch as FetchLike): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; PesitoPrecios/1.0; +https://www.pesito.com.ar)" },
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok && res.status !== 206) throw new Error(`respondió ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
