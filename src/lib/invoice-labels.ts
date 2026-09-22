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
 * Si no tiene cliente o es Consumidor Final, se calcula automáticamente
 * según el medio de pago.
 */
export function resolveInvoiceType(
  customerInvoiceType: string | null | undefined,
  paymentMethod: string
): InvoiceType {
  if (
    customerInvoiceType &&
    customerInvoiceType !== "consumidor_final" &&
    invoiceLabels[customerInvoiceType]
  ) {
    return customerInvoiceType as InvoiceType;
  }
  return defaultInvoiceTypeByPayment[paymentMethod] ?? "consumidor_final";
}
