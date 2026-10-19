import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { ARG_TZ, argDateString, argMidnightUTC } from "@/lib/timezone";

// Exportación de los datos del negocio a CSV (se abre en Excel). Sólo servidor. La usa
// /configuracion/exportar; cada conjunto tiene su lista de columnas y se arma con los mismos
// datos que ve el negocio, sin tocar nada.

export type ExportKind = "productos" | "clientes" | "proveedores" | "ventas" | "compras" | "movimientos";

export const EXPORT_KINDS: { kind: ExportKind; label: string; description: string; ranged: boolean }[] = [
  { kind: "productos", label: "Productos", description: "Tu catálogo: nombre, marca, códigos, precio, costo, stock y si está activo.", ranged: false },
  { kind: "clientes", label: "Clientes", description: "Datos de contacto y lo que cada uno te debe hoy.", ranged: false },
  { kind: "proveedores", label: "Proveedores", description: "Datos de contacto y lo que le debés a cada uno hoy.", ranged: false },
  { kind: "ventas", label: "Ventas", description: "Cada venta: fecha, total, medio de pago, cliente y si fue anulada.", ranged: true },
  { kind: "compras", label: "Compras", description: "Cada compra: fecha, proveedor, total, lo que quedó a cuenta y si fue anulada.", ranged: true },
  { kind: "movimientos", label: "Movimientos de stock", description: "Cada entrada y salida de mercadería: fecha, producto, tipo y cantidad.", ranged: true },
];

/** Tope de filas por archivo (si hay más, se bajan las más recientes: acotá con las fechas). */
export const EXPORT_MAX_ROWS = 100_000;

const SEP = ";"; // el Excel en español usa punto y coma
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (typeof value === "number") text = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100).replace(".", ",");
  else if (typeof value === "boolean") text = value ? "Sí" : "No";
  else text = String(value);
  // Una celda que empieza con = + - @ la toma Excel como fórmula: se anula con una comilla.
  if (/^[=+\-@\t\r]/.test(text) && typeof value === "string") text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV con BOM (para que Excel respete los acentos) y punto y coma como separador. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(SEP)).join("\r\n") + "\r\n";
}

const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARG_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const when = (iso: string) => dateTime.format(new Date(iso)).replace(",", "");

/** Rango "desde"/"hasta" (YYYY-MM-DD, hora de Argentina) como instantes; null si no se pidió o es inválido. */
export function parseRange(desde: string | null, hasta: string | null): { from: string | null; to: string | null } {
  const ok = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(argMidnightUTC(v).getTime()) ? v : null);
  const d = ok(desde);
  const h = ok(hasta);
  return {
    from: d ? argMidnightUTC(d).toISOString() : null,
    // hasta es inclusivo: hasta el final de ese día
    to: h ? new Date(argMidnightUTC(h).getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
  };
}

type Client = SupabaseClient<Database>;

export async function buildExport(
  supabase: Client,
  orgId: string,
  kind: ExportKind,
  range: { from: string | null; to: string | null }
): Promise<{ csv: string; rows: number; truncated: boolean }> {
  const cap = <T>(rows: T[]) => ({ rows: rows.slice(0, EXPORT_MAX_ROWS), truncated: rows.length > EXPORT_MAX_ROWS });
  const inRange = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(q: T): T => {
    let r = q;
    if (range.from) r = r.gte("created_at", range.from);
    if (range.to) r = r.lt("created_at", range.to);
    return r;
  };

  if (kind === "productos") {
    const data = await fetchAll((from, to) =>
      supabase.from("products").select("id, name, brand, sku, barcode, unit, price, cost, stock, min_stock, active").eq("org_id", orgId).order("name").order("id").range(from, to)
    );
    const { rows, truncated } = cap(data);
    return {
      csv: toCsv(["Nombre", "Marca", "SKU", "Código de barras", "Unidad", "Precio", "Costo", "Stock", "Stock mínimo", "Activo"], rows.map((p) => [p.name, p.brand, p.sku, p.barcode, p.unit, Number(p.price), p.cost === null ? null : Number(p.cost), Number(p.stock), Number(p.min_stock), p.active])),
      rows: rows.length,
      truncated,
    };
  }
  if (kind === "clientes") {
    const data = await fetchAll((from, to) =>
      supabase.from("customers").select("id, name, razon_social, document, phone, email, balance, created_at").eq("org_id", orgId).order("name").order("id").range(from, to)
    );
    const { rows, truncated } = cap(data);
    return {
      csv: toCsv(["Nombre", "Razón social", "Documento", "Teléfono", "Email", "Te debe", "Alta"], rows.map((c) => [c.name, c.razon_social, c.document, c.phone, c.email, Number(c.balance), when(c.created_at)])),
      rows: rows.length,
      truncated,
    };
  }
  if (kind === "proveedores") {
    const data = await fetchAll((from, to) =>
      supabase.from("suppliers").select("id, name, phone, email, balance, created_at").eq("org_id", orgId).order("name").order("id").range(from, to)
    );
    const { rows, truncated } = cap(data);
    return {
      csv: toCsv(["Nombre", "Teléfono", "Email", "Le debés", "Alta"], rows.map((s) => [s.name, s.phone, s.email, Number(s.balance), when(s.created_at)])),
      rows: rows.length,
      truncated,
    };
  }
  if (kind === "ventas") {
    const [data, customers] = await Promise.all([
      fetchAll((from, to) =>
        inRange(supabase.from("sales").select("id, created_at, subtotal, discount, surcharge, total, payment_method, invoice_type, status, customer_id").eq("org_id", orgId)).order("created_at", { ascending: false }).order("id").range(from, to)
      ),
      fetchAll((from, to) => supabase.from("customers").select("id, name").eq("org_id", orgId).order("id").range(from, to)),
    ]);
    const names = new Map(customers.map((c) => [c.id, c.name]));
    const { rows, truncated } = cap(data);
    return {
      csv: toCsv(["Fecha", "Cliente", "Subtotal", "Descuento", "Recargo", "Total", "Medio de pago", "Comprobante", "Estado"], rows.map((s) => [when(s.created_at), s.customer_id ? (names.get(s.customer_id) ?? "Cliente eliminado") : "Consumidor final", Number(s.subtotal), Number(s.discount), Number(s.surcharge), Number(s.total), s.payment_method, s.invoice_type, s.status === "anulada" ? "Anulada" : "Completada"])),
      rows: rows.length,
      truncated,
    };
  }
  if (kind === "compras") {
    const [data, suppliers] = await Promise.all([
      fetchAll((from, to) =>
        inRange(supabase.from("purchases").select("id, created_at, total, account_amount, payment_method, status, notes, supplier_id").eq("org_id", orgId)).order("created_at", { ascending: false }).order("id").range(from, to)
      ),
      fetchAll((from, to) => supabase.from("suppliers").select("id, name").eq("org_id", orgId).order("id").range(from, to)),
    ]);
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    const { rows, truncated } = cap(data);
    return {
      csv: toCsv(["Fecha", "Proveedor", "Total", "A cuenta", "Medio de pago", "Estado", "Notas"], rows.map((p) => [when(p.created_at), p.supplier_id ? (names.get(p.supplier_id) ?? "Proveedor eliminado") : "Sin proveedor", Number(p.total), Number(p.account_amount ?? 0), p.payment_method, p.status === "anulada" ? "Anulada" : "Completada", p.notes])),
      rows: rows.length,
      truncated,
    };
  }
  // movimientos
  const [data, products] = await Promise.all([
    fetchAll((from, to) =>
      inRange(supabase.from("stock_movements").select("id, created_at, product_id, type, quantity, reference").eq("org_id", orgId)).order("created_at", { ascending: false }).order("id").range(from, to)
    ),
    fetchAll((from, to) => supabase.from("products").select("id, name, sku").eq("org_id", orgId).order("id").range(from, to)),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const { rows, truncated } = cap(data);
  return {
    csv: toCsv(["Fecha", "Producto", "SKU", "Tipo", "Cantidad", "Referencia"], rows.map((m) => [when(m.created_at), byId.get(m.product_id)?.name ?? "Producto eliminado", byId.get(m.product_id)?.sku ?? null, m.type, Number(m.quantity), m.reference && !UUID_RE.test(m.reference) ? m.reference : null])),
    rows: rows.length,
    truncated,
  };
}

export function exportFileName(kind: ExportKind): string {
  return `pesito-${kind}-${argDateString()}.csv`;
}
