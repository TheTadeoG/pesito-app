/** Medios de pago que se pueden facturar solos al cobrar (los demás quedan con el botón «Facturar»). */
export const AUTO_INVOICE_METHODS = [
  { id: "efectivo", label: "Efectivo", note: null },
  { id: "tarjeta", label: "Tarjeta", note: null },
  { id: "transferencia", label: "Transferencia", note: null },
  { id: "qr", label: "QR", note: null },
  { id: "mixto", label: "Pago mixto", note: "Cuando la venta se paga con más de un medio." },
  { id: "fiado", label: "Fiado (cuenta corriente)", note: "Se factura al vender, aunque el cliente todavía no haya pagado." },
] as const;

export type AutoInvoiceMethod = (typeof AUTO_INVOICE_METHODS)[number]["id"];

export const autoInvoiceMethodIds: string[] = AUTO_INVOICE_METHODS.map((m) => m.id);

/** ¿Esta venta se factura sola? (La emisión al cobrar usa esto; ver también el botón «Facturar» manual.) */
export function isAutoInvoiced(method: string, selected: readonly string[]): boolean {
  return selected.includes(method);
}
