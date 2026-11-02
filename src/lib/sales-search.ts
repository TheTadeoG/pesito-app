// Qué puede ser lo que se escribe en el buscador del historial de ventas: un número de comprobante
// («00003-00000004» o «4»), un CAE (14 dígitos), un importe («1.150,50») o texto (cliente, CUIT/DNI).

export interface SalesSearch {
  /** Texto limpio, para buscar en nombre y documento del cliente. */
  text: string;
  /** Número de comprobante (la parte después del guion si viene con punto de venta). */
  voucherNumber: number | null;
  /** Número de CAE de 14 dígitos. */
  cae: string | null;
  /** Importe de la venta, en pesos. */
  amount: number | null;
}

/** «1.150,50», «1150,5», «$ 1150», «1,150.50» → número en pesos (o null si no parece un importe). */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[$\s]/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Gana como decimal el que está más a la derecha; el otro es separador de miles.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 1e12 ? Math.round(n * 100) / 100 : null;
}

export function parseSalesSearch(raw: string): SalesSearch {
  const text = raw.trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim();
  const digits = raw.replace(/\D/g, "");
  const cae = /^\d{14}$/.test(raw.replace(/\s/g, "")) ? raw.replace(/\s/g, "") : null;
  let voucherNumber: number | null = null;
  const withPoint = raw.trim().match(/^\d{1,5}\s*-\s*(\d{1,8})$/);
  if (withPoint) voucherNumber = Number(withPoint[1]);
  else if (/^\d{1,8}$/.test(raw.trim())) voucherNumber = Number(raw.trim());
  return { text, voucherNumber, cae: cae ?? (digits.length === 14 && !/[a-z]/i.test(raw) ? digits : null), amount: parseAmount(raw.trim()) };
}
