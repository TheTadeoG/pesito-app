import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { withBranchStock, type Branch } from "@/lib/branches";

// Funciones del Plan IA que salen de las ventas de cada producto: baja
// rotación, reposición y sugerencia de precios. Las ventas por producto
// vienen resumidas de la base (product_sales_stats, 0050); acá sólo se
// hacen las cuentas, sin consultas.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InsightProduct {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  unit: string;
  price: number;
  cost: number | null;
  stock: number;
  min_stock: number;
  default_supplier_id: string | null;
  /** Unidades por bulto del proveedor (0052); null si se compra suelto o falta la migración. */
  pack_size: number | null;
  created_at: string;
}

export interface SalesStat {
  qtySold: number;
  revenue: number;
  saleDays: number;
  lastSoldAt: Date | null;
}

export interface InsightsBase {
  products: InsightProduct[];
  stats: Map<string, SalesStat>;
  supplierNames: Map<string, string>;
  /** Días que tarda en llegar un pedido de cada proveedor (0052); sólo los que lo cargaron. */
  supplierLeadDays: Map<string, number>;
  /** Pedido mínimo de cada proveedor en pesos (0054); sólo los que lo cargaron. */
  supplierMinOrder: Map<string, number>;
  /** Lo que ya se pidió y todavía no llegó, por producto (0053). Lo carga quien lo use. */
  onOrder: Map<string, number>;
}

/** Productos activos (con el stock de la sucursal) + ventas de los últimos `days` días. */
export async function loadInsightsBase(
  supabase: SupabaseClient<Database>,
  orgId: string,
  branch: Branch | null,
  days: number
): Promise<InsightsBase> {
  const [rawProducts, statsResult, { data: suppliers }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, name, brand, barcode, unit, price, cost, stock, min_stock, default_supplier_id, created_at")
        .eq("org_id", orgId)
        .eq("active", true)
        .order("name")
        .order("id")
        .range(from, to)
    ),
    supabase.rpc("product_sales_stats", {
      p_org_id: orgId,
      p_days: days,
      p_branch_id: branch?.id ?? null,
    }),
    // "*": el plazo de entrega (0052) puede no existir todavía en la base.
    supabase.from("suppliers").select("*").eq("org_id", orgId),
  ]);
  if (statsResult.error) throw new Error("No pudimos analizar las ventas por producto.");

  // Unidades por bulto (0052): consulta aparte para que, sin la migración, el
  // resto de las recomendaciones siga andando.
  const packSizes = new Map<string, number>();
  try {
    const packRows = await fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, pack_size")
        .eq("org_id", orgId)
        .eq("active", true)
        .not("pack_size", "is", null)
        .order("id")
        .range(from, to)
    );
    for (const row of packRows) {
      if (row.pack_size !== null && row.pack_size !== undefined) packSizes.set(row.id, Number(row.pack_size));
    }
  } catch {
    // Sin la columna: se compra suelto.
  }

  const withStock = await withBranchStock(supabase, branch, rawProducts);
  const products = withStock.map((p) => ({
    ...p,
    pack_size: packSizes.get(p.id) ?? null,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
  }));

  const stats = new Map<string, SalesStat>();
  for (const row of statsResult.data ?? []) {
    stats.set(row.product_id, {
      qtySold: Number(row.qty_sold),
      revenue: Number(row.revenue),
      saleDays: Number(row.sale_days),
      lastSoldAt: row.last_sold_at ? new Date(row.last_sold_at) : null,
    });
  }

  return {
    products,
    stats,
    supplierNames: new Map((suppliers ?? []).map((s) => [s.id, s.name])),
    supplierLeadDays: new Map(
      (suppliers ?? [])
        .filter((s) => s.lead_time_days !== null && s.lead_time_days !== undefined)
        .map((s) => [s.id, Number(s.lead_time_days)])
    ),
    supplierMinOrder: new Map(
      (suppliers ?? [])
        .filter((s) => s.min_order_amount !== null && s.min_order_amount !== undefined && Number(s.min_order_amount) > 0)
        .map((s) => [s.id, Number(s.min_order_amount)])
    ),
    onOrder: new Map(),
  };
}

function ageInDays(product: InsightProduct, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(product.created_at).getTime()) / DAY_MS);
}

/** Unidades por día, sin contar los días en que el producto todavía no existía. */
function dailyRate(product: InsightProduct, stat: SalesStat | undefined, windowDays: number, now: Date) {
  if (!stat || stat.qtySold <= 0) return 0;
  const days = Math.min(windowDays, Math.max(7, ageInDays(product, now)));
  return stat.qtySold / days;
}

// ---------------------------------------------------------------------------
// Baja rotación
// ---------------------------------------------------------------------------

/** Con este ritmo, stock para más de medio año: "se vende poco". */
export const SLOW_COVER_DAYS = 180;

export interface LowRotationRow {
  product: InsightProduct;
  kind: "sin-ventas" | "lenta";
  /** Días desde la última venta (null: no se vendió en el último año). */
  daysSinceSale: number | null;
  soldInPeriod: number;
  /** Días que dura el stock al ritmo actual (sólo "lenta"). */
  coverDays: number | null;
  /** Plata parada en la góndola: stock × costo (null si no tiene costo). */
  capital: number | null;
}

export function computeLowRotation(
  base: InsightsBase,
  days: number,
  now: Date = new Date()
): LowRotationRow[] {
  const rows: LowRotationRow[] = [];
  for (const product of base.products) {
    if (product.stock <= 0) continue;
    // Un producto recién cargado todavía no tuvo tiempo de venderse.
    if (ageInDays(product, now) < days) continue;
    const stat = base.stats.get(product.id);
    const sold = stat?.qtySold ?? 0;
    const rate = dailyRate(product, stat, days, now);
    const coverDays = rate > 0 ? product.stock / rate : null;
    let kind: LowRotationRow["kind"] | null = null;
    if (sold <= 0) kind = "sin-ventas";
    else if (coverDays !== null && coverDays > SLOW_COVER_DAYS) kind = "lenta";
    if (!kind) continue;
    rows.push({
      product,
      kind,
      daysSinceSale: stat?.lastSoldAt
        ? Math.floor((now.getTime() - stat.lastSoldAt.getTime()) / DAY_MS)
        : null,
      soldInPeriod: sold,
      coverDays: kind === "lenta" ? coverDays : null,
      capital: product.cost !== null && product.cost > 0 ? product.stock * product.cost : null,
    });
  }
  return rows.sort((a, b) => (b.capital ?? 0) - (a.capital ?? 0));
}

// ---------------------------------------------------------------------------
// Reposición
// ---------------------------------------------------------------------------

export interface RestockRow {
  product: InsightProduct;
  perDay: number;
  /** Días que alcanza el stock (null: no se vendió en el período). */
  daysLeft: number | null;
  /** Cantidad a comprar en la unidad del producto (con bultos, ya redondeada al bulto). */
  suggestedQty: number;
  /** Bultos a pedir (null si el producto se compra suelto). */
  packs: number | null;
  packSize: number | null;
  /** suggestedQty × costo (null si no tiene costo). */
  estimatedCost: number | null;
  urgency: "sin-stock" | "urgente" | "pronto";
  /** El stock se acaba antes de que llegue un pedido hecho hoy (según el plazo del proveedor). */
  late: boolean;
  /** Lo que ya se pidió y no llegó (ya descontado de la cantidad sugerida). */
  onOrder: number;
  /** Hay pocos datos de venta (producto nuevo o pocos días con ventas): el ritmo es poco confiable. */
  lowHistory: boolean;
}

export interface RestockGroup {
  supplierId: string | null;
  supplierName: string;
  rows: RestockRow[];
  estimatedCost: number;
  /** Plazo de entrega del proveedor en días (null si no lo cargó). */
  leadDays: number | null;
  /** Pedido mínimo del proveedor en pesos (null si no lo cargó). */
  minOrder: number | null;
}

export interface RestockSettings {
  /** Días de venta que se quiere tener cubiertos cuando llega el pedido. */
  targetDays: number;
  /** Cuántos días de ventas hacia atrás se miran. */
  windowDays: number;
  /** Colchón de seguridad, en días de venta. */
  safetyDays: number;
}

export const DEFAULT_RESTOCK_SETTINGS: RestockSettings = { targetDays: 14, windowDays: 30, safetyDays: 0 };

const WHOLE_UNITS = new Set(["u", "pack", "caja"]);

function roundQty(qty: number, unit: string): number {
  if (WHOLE_UNITS.has(unit)) return Math.ceil(qty - 1e-9);
  if (unit === "g" || unit === "ml") return Math.ceil(qty / 100) * 100;
  return Math.ceil(qty * 10 - 1e-9) / 10;
}

/**
 * Qué comprar. Se mira el ritmo de venta de los últimos `windowDays` días y se
 * pide lo necesario para que, cuando llegue el pedido (plazo del proveedor),
 * queden `targetDays` días de venta más el colchón de seguridad. Nunca menos
 * que el stock mínimo del producto. Si el producto viene en bultos, se pide
 * en bultos enteros.
 */
export function computeRestock(
  base: InsightsBase,
  settings: RestockSettings,
  now: Date = new Date()
): RestockGroup[] {
  const { windowDays, targetDays, safetyDays } = settings;
  const groups = new Map<string, RestockGroup>();
  for (const product of base.products) {
    const stat = base.stats.get(product.id);
    const perDay = dailyRate(product, stat, windowDays, now);
    if (perDay <= 0 && (product.min_stock <= 0 || product.stock > product.min_stock)) continue;
    const leadDays = product.default_supplier_id
      ? base.supplierLeadDays.get(product.default_supplier_id) ?? 0
      : 0;
    const wanted = Math.max(perDay * (targetDays + leadDays + safetyDays), product.min_stock);
    const onOrder = base.onOrder.get(product.id) ?? 0;
    const missing = wanted - Math.max(0, product.stock) - onOrder;
    if (missing <= 0) continue;

    const packSize = product.pack_size !== null && product.pack_size > 0 ? product.pack_size : null;
    const packs = packSize ? Math.max(1, Math.ceil(missing / packSize - 1e-9)) : null;
    const suggestedQty = packSize && packs ? packs * packSize : roundQty(missing, product.unit);
    if (suggestedQty <= 0) continue;

    const daysLeft = perDay > 0 ? Math.max(0, product.stock) / perDay : null;
    // "Urgente": el stock no alcanza para lo que tarda el pedido más el colchón
    // (mínimo 3 días, como siempre).
    const urgentDays = Math.max(3, leadDays + safetyDays);
    const urgency: RestockRow["urgency"] =
      product.stock <= 0 ? "sin-stock" : daysLeft !== null && daysLeft <= urgentDays ? "urgente" : "pronto";
    const late = leadDays > 0 && daysLeft !== null && daysLeft < leadDays;
    const lowHistory = perDay > 0 && (ageInDays(product, now) < 14 || (stat?.saleDays ?? 0) < 3);

    const key = product.default_supplier_id ?? "";
    const group = groups.get(key) ?? {
      supplierId: product.default_supplier_id,
      supplierName: product.default_supplier_id
        ? base.supplierNames.get(product.default_supplier_id) ?? "Proveedor"
        : "Sin proveedor asignado",
      rows: [],
      estimatedCost: 0,
      leadDays: product.default_supplier_id
        ? base.supplierLeadDays.get(product.default_supplier_id) ?? null
        : null,
      minOrder: product.default_supplier_id
        ? base.supplierMinOrder.get(product.default_supplier_id) ?? null
        : null,
    };
    const estimatedCost = product.cost !== null && product.cost > 0 ? suggestedQty * product.cost : null;
    group.rows.push({
      product,
      perDay,
      daysLeft,
      suggestedQty,
      packs,
      packSize,
      estimatedCost,
      urgency,
      late,
      onOrder,
      lowHistory,
    });
    group.estimatedCost += estimatedCost ?? 0;
    groups.set(key, group);
  }

  const urgencyOrder = { "sin-stock": 0, urgente: 1, pronto: 2 };
  for (const group of groups.values()) {
    group.rows.sort(
      (a, b) =>
        urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
        (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity)
    );
  }
  // Los que tienen proveedor primero (más urgentes arriba); "sin proveedor" al final.
  return Array.from(groups.values()).sort((a, b) => {
    if (!a.supplierId !== !b.supplierId) return a.supplierId ? -1 : 1;
    return urgencyOrder[a.rows[0].urgency] - urgencyOrder[b.rows[0].urgency] || b.rows.length - a.rows.length;
  });
}

/** "2 bultos de 12 (24 u)" o "24 u" según se compre en bultos o suelto. */
export function restockQtyLabel(row: RestockRow): string {
  if (row.packs && row.packSize) {
    const bultos = `${row.packs} bulto${row.packs === 1 ? "" : "s"} de ${formatQty(row.packSize, row.product.unit)}`;
    return `${bultos} (${formatQty(row.suggestedQty, row.product.unit)})`;
  }
  return formatQty(row.suggestedQty, row.product.unit);
}

/** Pedido listo para mandar por WhatsApp al proveedor. */
export function restockOrderText(orgName: string, group: RestockGroup): string {
  const lines = group.rows.map((r) => `- ${restockQtyLabel(r)} ${r.product.name}`);
  return `Hola! Te paso el pedido de ${orgName}:\n${lines.join("\n")}\nGracias!`;
}

export function formatQty(qty: number, unit: string): string {
  const n = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(qty);
  return unit === "u" ? n : `${n} ${unit}`;
}

// ---------------------------------------------------------------------------
// Sugerencia de precios
// ---------------------------------------------------------------------------

export interface PriceChange {
  product_id: string;
  created_at: string;
  old_value: number;
  new_value: number;
}

export interface PriceSuggestion {
  product: InsightProduct;
  reason: "costo-subio" | "perdida" | "margen-bajo";
  detail: string;
  suggestedPrice: number;
  /** Ganancia sobre el costo, en %, hoy y con el precio sugerido. */
  currentMarkup: number;
  suggestedMarkup: number;
}

/** Redondea para arriba a un precio "de góndola". */
export function roundPrice(value: number): number {
  const step = value < 1000 ? 10 : value < 10000 ? 50 : 100;
  return Math.ceil(value / step - 1e-9) * step;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Historial de precios y costos del último año (del más viejo al más nuevo). */
export async function loadPriceHistory(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<{ prices: PriceChange[]; costs: PriceChange[] }> {
  const since = new Date(Date.now() - 365 * DAY_MS).toISOString();
  const [prices, costs] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("product_price_history")
        .select("id, product_id, created_at, old_price, new_price")
        .eq("org_id", orgId)
        .gte("created_at", since)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from("product_cost_history")
        .select("id, product_id, created_at, old_cost, new_cost")
        .eq("org_id", orgId)
        .gte("created_at", since)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
  ]);
  return {
    prices: prices.map((p) => ({
      product_id: p.product_id,
      created_at: p.created_at,
      old_value: Number(p.old_price),
      new_value: Number(p.new_price),
    })),
    costs: costs.map((c) => ({
      product_id: c.product_id,
      created_at: c.created_at,
      old_value: Number(c.old_cost),
      new_value: Number(c.new_cost),
    })),
  };
}

function groupByProduct(changes: PriceChange[]): Map<string, PriceChange[]> {
  const map = new Map<string, PriceChange[]>();
  for (const change of changes) {
    const list = map.get(change.product_id) ?? [];
    list.push(change);
    map.set(change.product_id, list);
  }
  return map;
}

const pct = (value: number) => `${Math.round(value)}%`;

/**
 * Tres casos, en este orden:
 * 1. El costo subió después del último cambio de precio: mismo margen que
 *    tenía cuando se puso ese precio.
 * 2. Se vende a pérdida.
 * 3. Margen menor al 10%.
 * En 2 y 3 el margen de referencia es el habitual de la marca (3+
 * productos) o, si no, el del negocio.
 */
export function computePriceSuggestions(
  base: InsightsBase,
  history: { prices: PriceChange[]; costs: PriceChange[] }
): PriceSuggestion[] {
  const pricesByProduct = groupByProduct(history.prices);
  const costsByProduct = groupByProduct(history.costs);

  const markups: number[] = [];
  const markupsByBrand = new Map<string, number[]>();
  for (const p of base.products) {
    if (!p.cost || p.cost <= 0 || p.price <= p.cost) continue;
    const markup = p.price / p.cost;
    markups.push(markup);
    if (p.brand) markupsByBrand.set(p.brand, [...(markupsByBrand.get(p.brand) ?? []), markup]);
  }
  const orgMarkup = median(markups);
  const referenceMarkup = (p: InsightProduct) => {
    const brand = p.brand ? markupsByBrand.get(p.brand) : undefined;
    if (brand && brand.length >= 3) return { markup: median(brand)!, source: `lo habitual en ${p.brand}` };
    return orgMarkup ? { markup: orgMarkup, source: "lo habitual en tu negocio" } : null;
  };

  const suggestions: PriceSuggestion[] = [];
  for (const product of base.products) {
    const cost = product.cost;
    if (!cost || cost <= 0 || product.price <= 0) continue;
    const currentMarkup = (product.price / cost - 1) * 100;

    let reason: PriceSuggestion["reason"] | null = null;
    let target = 0;
    let detail = "";

    const lastPriceChange = pricesByProduct.get(product.id)?.at(-1);
    const since = lastPriceChange?.created_at ?? product.created_at;
    const costChangesAfter = (costsByProduct.get(product.id) ?? []).filter((c) => c.created_at > since);
    const costThen = costChangesAfter[0]?.old_value ?? 0;
    if (costThen > 0 && cost > costThen * 1.01) {
      reason = "costo-subio";
      target = product.price * (cost / costThen);
      detail = `El costo subió ${pct((cost / costThen - 1) * 100)} desde que pusiste este precio.`;
    } else if (product.price < cost || currentMarkup < 10) {
      const ref = referenceMarkup(product);
      if (ref && ref.markup > 1.1) {
        reason = product.price < cost ? "perdida" : "margen-bajo";
        target = cost * ref.markup;
        detail =
          reason === "perdida"
            ? `Lo vendés por debajo del costo. Sugerimos ${pct((ref.markup - 1) * 100)} de ganancia, ${ref.source}.`
            : `Ganás ${pct(currentMarkup)} sobre el costo. Sugerimos ${pct((ref.markup - 1) * 100)}, ${ref.source}.`;
      }
    }
    if (!reason) continue;

    const suggestedPrice = roundPrice(target);
    if (suggestedPrice <= product.price * 1.01) continue;
    suggestions.push({
      product,
      reason,
      detail,
      suggestedPrice,
      currentMarkup,
      suggestedMarkup: (suggestedPrice / cost - 1) * 100,
    });
  }

  const reasonOrder = { perdida: 0, "costo-subio": 1, "margen-bajo": 2 };
  return suggestions.sort(
    (a, b) =>
      reasonOrder[a.reason] - reasonOrder[b.reason] ||
      b.suggestedPrice - b.product.price - (a.suggestedPrice - a.product.price)
  );
}
