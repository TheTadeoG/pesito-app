// Pasa una venta de Pesito a lo que pide ARCA. Puro (sin red ni base): se prueba solo.

export interface SaleLine {
  name: string;
  quantity: number;
  /** Subtotal de la línea en pesos, antes de descuentos y recargos de la venta. */
  subtotal: number;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  /** Importe de la línea en centavos, ya con el descuento o recargo de la venta repartido. */
  amount: number;
  /** Precio unitario en pesos como decimal (hasta 6 decimales). */
  unitPrice: string;
}

const cents = (pesos: number) => Math.round(pesos * 100);

/**
 * Líneas del comprobante en centavos. El descuento y el recargo de la venta se reparten en proporción entre las
 * líneas (así el comprobante muestra el precio realmente cobrado) y el resto del redondeo va a la línea más
 * grande: la suma de las líneas da siempre el total cobrado, al centavo.
 */
export function invoiceLines(lines: SaleLine[], saleTotal: number): InvoiceLine[] {
  const totalCents = cents(saleTotal);
  const base = lines.map((l) => cents(l.subtotal));
  const baseSum = base.reduce((n, v) => n + v, 0);
  if (lines.length === 0 || baseSum <= 0) return [];
  const amounts = base.map((v) => Math.round((v * totalCents) / baseSum));
  const diff = totalCents - amounts.reduce((n, v) => n + v, 0);
  if (diff !== 0) {
    const biggest = amounts.indexOf(Math.max(...amounts));
    amounts[biggest] += diff;
  }
  return lines.map((l, i) => {
    const qty = l.quantity > 0 ? l.quantity : 1;
    return {
      description: l.name.trim().slice(0, 100) || "Producto",
      quantity: qty,
      amount: amounts[i],
      unitPrice: (amounts[i] / 100 / qty).toFixed(6).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1"),
    };
  });
}

/** CUIT/CUIL (11 dígitos) o DNI (7 u 8) del cliente, si lo cargó; si no, Consumidor Final sin identificar. */
export function receiverFromDocument(document: string | null | undefined): { cuit?: string; dni?: string } {
  const digits = (document ?? "").replace(/\D/g, "");
  if (digits.length === 11) return { cuit: digits };
  if (digits.length === 7 || digits.length === 8) return { dni: digits };
  return {};
}

/** Cómo figura la condición de venta en el comprobante. */
export const saleConditionLabel: Record<string, string> = {
  efectivo: "Contado",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  qr: "QR",
  mixto: "Mixto",
  fiado: "Cuenta corriente",
};
