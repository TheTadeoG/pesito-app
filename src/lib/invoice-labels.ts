export type InvoiceType = "consumidor_final" | "factura_a" | "factura_b" | "factura_c";

export const invoiceTypes: { value: InvoiceType; label: string }[] = [
  { value: "consumidor_final", label: "Consumidor Final" },
  { value: "factura_a", label: "Factura A" },
  { value: "factura_b", label: "Factura B" },
  { value: "factura_c", label: "Factura C" },
];

export const invoiceLabels: Record<string, string> = Object.fromEntries(
  invoiceTypes.map((i) => [i.value, i.label])
);

/** Comprobante automático para "Consumidor Final" según el medio de pago. */
export const defaultInvoiceTypeByPayment: Record<string, InvoiceType> = {
  efectivo: "consumidor_final",
  qr: "consumidor_final",
  transferencia: "factura_b",
  tarjeta: "factura_b",
  mixto: "consumidor_final",
  fiado: "consumidor_final",
};

/**
 * Comprobante de una venta: si el cliente tiene un tipo fijo registrado
 * (p. ej. Factura A para un responsable inscripto), se usa siempre ese.
 * Si no, y la organización activó "facturación automática según medio de
 * pago" (desactivada por defecto), se sugiere un comprobante puntual para
 * tarjeta/transferencia. Si está desactivada, siempre queda Consumidor
 * Final salvo que el cliente tenga un tipo fijo.
 */
export function resolveInvoiceType(
  customerInvoiceType: string | null | undefined,
  paymentMethod: string,
  autoByPayment: boolean = false
): InvoiceType {
  if (
    customerInvoiceType &&
    customerInvoiceType !== "consumidor_final" &&
    invoiceLabels[customerInvoiceType]
  ) {
    return customerInvoiceType as InvoiceType;
  }
  if (!autoByPayment) return "consumidor_final";
  // Un medio no listado acá es uno personalizado de la organización (ej:
  // "Mercado Pago"): se trata como tarjeta/transferencia, no como efectivo.
  return defaultInvoiceTypeByPayment[paymentMethod] ?? "factura_b";
}
