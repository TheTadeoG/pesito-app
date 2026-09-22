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

/** Comprobante sugerido según el medio de pago elegido; el vendedor puede cambiarlo. */
export const defaultInvoiceTypeByPayment: Record<string, InvoiceType> = {
  efectivo: "consumidor_final",
  qr: "consumidor_final",
  transferencia: "factura_b",
  tarjeta: "factura_b",
  mixto: "consumidor_final",
  fiado: "consumidor_final",
};
