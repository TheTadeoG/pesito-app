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
  /** Cuánto se vende por día (0 si no se vendió en el período) y a qué precio. */
  perDay: number;
  price: number;
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
  why: WhyCalc;
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

/** Un proveedor al que se le puede mandar un pedido de productos que no tienen proveedor habitual. */
export interface SupplierOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  leadDays: number | null;
  arrivalLabel: string | null;
}

const MAX_ROWS = 60;

/** La cuenta detrás de la cantidad, lista para mostrarla como renglones. */
export interface WhyCalc {
  perDay: string | null;
  parts: { label: string; days: number }[];
  totalDays: number;
  need: string;
  have: string;
  onOrder: string | null;
  buy: string;
  /** Cuando no hay ventas o manda el stock mínimo. */
  note: string | null;
}

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

function whyText(row: RestockRow, leadDays: number, settings: RestockSettings): WhyCalc {
  const { product, perDay, onOrder } = row;
  const stock = Math.max(0, product.stock);
  const buy =
    row.packs && row.packSize
      ? `${row.packs} bulto${row.packs === 1 ? "" : "s"} de ${formatQty(row.packSize, product.unit)} (${formatQty(row.suggestedQty, product.unit)})`
      : formatQty(row.suggestedQty, product.unit);
  const base = {
    have: formatQty(stock, product.unit),
    onOrder: onOrder > 0 ? formatQty(onOrder, product.unit) : null,
    buy,
  };

  if (perDay <= 0) {
    return {
      ...base,
      perDay: null,
      parts: [],
      totalDays: 0,
      need: formatQty(product.min_stock, product.unit),
      note: `No vendiste este producto en los últimos ${days(settings.windowDays)}, así que usamos el stock mínimo que cargaste.`,
    };
  }
  const parts = [
    { label: "Para que te dure después de que llegue", days: settings.targetDays },
    ...(leadDays > 0 ? [{ label: "Lo que tarda en llegar", days: leadDays }] : []),
    ...(settings.safetyDays > 0 ? [{ label: "De reserva, por si se demora", days: settings.safetyDays }] : []),
  ];
  const totalDays = parts.reduce((n, part) => n + part.days, 0);
  const raw = perDay * totalDays;
  const minWins = product.min_stock > raw;
  return {
    ...base,
    perDay: formatQty(perDay, product.unit),
    parts,
    totalDays,
    need: formatQty(Math.max(raw, product.min_stock), product.unit),
    note: minWins ? `Como tu stock mínimo (${formatQty(product.min_stock, product.unit)}) es mayor, apuntamos a tener eso.` : null,
  };
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
        perDay: r.perDay,
        price: r.product.price,
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

export function buildSupplierOptions(base: InsightsBase, now: Date = new Date()): SupplierOption[] {
  return Array.from(base.supplierNames.entries())
    .map(([id, name]) => {
      const leadDays = base.supplierLeadDays.get(id) ?? null;
      const contact = base.supplierContacts.get(id);
      return {
        id,
        name,
        phone: contact?.phone ?? null,
        email: contact?.email ?? null,
        leadDays,
        arrivalLabel: arrivalLabel(leadDays, now),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
