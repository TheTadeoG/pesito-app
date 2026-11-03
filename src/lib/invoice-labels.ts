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

export type IssuerCondition = "monotributo" | "responsable_inscripto" | "exento";
export type TaxCondition = "responsable_inscripto" | "monotributo" | "exento" | "no_alcanzado" | "consumidor_final";

/**
 * Comprobantes que se le pueden hacer a un cliente: sólo los que el negocio emite según su condición frente al
 * IVA y que el cliente puede recibir.
 *  - Siempre se puede no facturar (consumidor_final: ticket interno X).
 *  - Monotributo o IVA exento: sólo Factura C, a cualquier cliente.
 *  - Responsable inscripto: Factura A a otro responsable inscripto y también a un monotributista (Ley 27.618,
 *    Régimen de Sostenimiento e Inclusión Fiscal: con crédito fiscal discriminado y esa leyenda); Factura B a
 *    consumidor final, IVA exento y no alcanzado (con la condición del cliente sin cargar, se ofrecen las dos).
 *  - Sin la facturación configurada: ninguno.
 */
export function allowedInvoiceTypes(issuer: IssuerCondition | null, customer: TaxCondition | "" | null): InvoiceType[] {
  if (!issuer) return ["consumidor_final"];
  if (issuer === "monotributo" || issuer === "exento") return ["consumidor_final", "factura_c"];
  if (customer === "responsable_inscripto" || customer === "monotributo") return ["consumidor_final", "factura_a"];
  if (customer) return ["consumidor_final", "factura_b"];
  return ["consumidor_final", "factura_a", "factura_b"];
}

/** Un consumidor final cargado como cliente se identifica con su DNI (o CUIL/CUIT): 7 u 8 dígitos, u 11. */
export function hasIdentification(document: string | null | undefined): boolean {
  const digits = (document ?? "").replace(/\D/g, "");
  return digits.length === 7 || digits.length === 8 || digits.length === 11;
}

export const CONSUMER_NEEDS_DNI_MESSAGE = "Un consumidor final se carga con su DNI (o CUIL): lo necesita ARCA para identificarlo en las facturas.";
