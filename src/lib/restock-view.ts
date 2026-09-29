import {
  formatQty,
  type InsightsBase,
  type RestockGroup,
  type RestockRow,
  type RestockSettings,
} from "@/lib/product-insights";

// Datos de "Qué comprar" listos para mostrar: todo en frases y números ya
// formateados, sin nada que dependa del servidor, para pasarlo a la pantalla
// del pedido (que corre en el navegador).

export interface FlowRow {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  stock: number;
  minStock: number;
  stockLabel: string;
  daysLeft: number | null;
  urgency: RestockRow["urgency"];
  lowHistory: boolean;
  /** "12 u" si ya hay un pedido sin recibir de este producto. */
  onOrderLabel: string | null;
  /** Unidades por bulto (null si se compra suelto). */
  packSize: number | null;
  /** Lo sugerido: bultos si viene en bultos, si no unidades. */
  suggestedAmount: number;
  unitCost: number | null;
  /** Por qué se sugiere esa cantidad, en una frase. */
  why: string;
}

export interface FlowGroup {
  key: string;
  supplierId: string | null;
  supplierName: string;
  leadDays: number | null;
  minOrder: number | null;
  phone: string | null;
  email: string | null;
  /** "jueves 2/10": cuándo llegaría un pedido hecho hoy (null si no se sabe el plazo). */
  arrivalLabel: string | null;
  rows: FlowRow[];
}

const MAX_ROWS = 60;

export function arrivalLabel(leadDays: number | null, now: Date = new Date()): string | null {
  if (leadDays === null || leadDays <= 0) return null;
  const date = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  })
    .format(date)
    .replace(",", "");
}

function days(n: number): string {
  return `${n} día${n === 1 ? "" : "s"}`;
}

function whyText(row: RestockRow, leadDays: number, settings: RestockSettings): string {
  const { product, perDay, onOrder } = row;
  const stock = Math.max(0, product.stock);
  const have = `Tenés ${formatQty(stock, product.unit)}${onOrder > 0 ? ` y ya vienen ${formatQty(onOrder, product.unit)} en camino` : ""}`;
  const buy =
    row.packs && row.packSize
      ? `${row.packs} bulto${row.packs === 1 ? "" : "s"} de ${formatQty(row.packSize, product.unit)} (${formatQty(row.suggestedQty, product.unit)})`
      : formatQty(row.suggestedQty, product.unit);

  if (perDay <= 0) {
    return `No vendiste este producto en los últimos ${days(settings.windowDays)}, así que usamos el stock mínimo que cargaste (${formatQty(product.min_stock, product.unit)}). ${have}, así que conviene pedir ${buy}.`;
  }
  const wanted = Math.max(perDay * (settings.targetDays + leadDays + settings.safetyDays), product.min_stock);
  const wait =
    leadDays > 0
      ? `El pedido tarda ${days(leadDays)} en llegar${settings.safetyDays > 0 ? ` y dejamos ${days(settings.safetyDays)} de margen` : ""}.`
      : settings.safetyDays > 0
        ? `Dejamos ${days(settings.safetyDays)} de margen.`
        : "";
  return `Vendés ${formatQty(perDay, product.unit)} por día. ${wait} Para tener stock para ${days(settings.targetDays)} después de que llegue, necesitás ${formatQty(wanted, product.unit)} en total. ${have}, así que conviene pedir ${buy}.`
    .replace(/\s+/g, " ")
    .trim();
}

export function buildFlowGroups(
  groups: RestockGroup[],
  base: InsightsBase,
  settings: RestockSettings,
  now: Date = new Date()
): FlowGroup[] {
  return groups.map((group) => {
    const contact = group.supplierId ? base.supplierContacts.get(group.supplierId) : undefined;
    const lead = group.leadDays ?? 0;
    return {
      key: group.supplierId ?? "sin",
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      leadDays: group.leadDays,
      minOrder: group.minOrder,
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
      arrivalLabel: arrivalLabel(group.leadDays, now),
      rows: group.rows.slice(0, MAX_ROWS).map((r) => ({
        id: r.product.id,
        name: r.product.name,
        brand: r.product.brand,
        unit: r.product.unit,
        stock: r.product.stock,
        minStock: r.product.min_stock,
        stockLabel: formatQty(Math.max(0, r.product.stock), r.product.unit),
        daysLeft: r.daysLeft,
        urgency: r.urgency,
        lowHistory: r.lowHistory,
        onOrderLabel: r.onOrder > 0 ? formatQty(r.onOrder, r.product.unit) : null,
        packSize: r.packSize,
        suggestedAmount: r.packs ?? r.suggestedQty,
        unitCost: r.product.cost !== null && r.product.cost > 0 ? r.product.cost : null,
        why: whyText(r, lead, settings),
      })),
    };
  });
}
