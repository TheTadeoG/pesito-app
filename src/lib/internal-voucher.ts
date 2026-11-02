/**
 * Lo que Pesito entrega cuando la venta no tiene factura electrónica: un comprobante interno, del tipo «X»
 * (el que en Argentina lleva la leyenda «Documento no válido como factura»).
 */
export const INTERNAL_VOUCHER_LABEL = "Comprobante X";
export const INTERNAL_VOUCHER_LEGEND = "DOCUMENTO NO VÁLIDO COMO FACTURA";

/** «X 0001-00000012»: el comprobante interno tiene numeración propia por negocio (la asigna la base al vender). */
export function internalNumberLabel(n: number | null | undefined): string {
  return n ? `X 0001-${String(n).padStart(8, "0")}` : INTERNAL_VOUCHER_LABEL;
}

/** Título del ticket interno: «COMPROBANTE X 0001-00000012», o sólo «COMPROBANTE X» si no se muestra el número. */
export function internalTicketTitle(n: number | null | undefined): string {
  return n ? `COMPROBANTE ${internalNumberLabel(n)}` : "COMPROBANTE X";
}
