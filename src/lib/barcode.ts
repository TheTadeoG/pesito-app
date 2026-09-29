// Códigos de barras EAN-13 propios de Pesito.
//
// Los códigos que genera Pesito empiezan con 200: el rango 200-299 lo reserva
// GS1 (el organismo que asigna los códigos de los productos del mundo) para
// uso interno de cada negocio, así que nunca coinciden con el código de un
// producto de fábrica. Después van 9 dígitos al azar y el dígito verificador.

/** Prefijo de los códigos generados por Pesito (rango de uso interno de GS1). */
export const INTERNAL_PREFIX = "200";

/** Dígito verificador de los primeros 12 dígitos de un EAN-13. */
export function ean13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** ¿Es un EAN-13 válido (13 dígitos y dígito verificador correcto)? */
export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/**
 * EAN-13 para imprimir: acepta un EAN-13 válido o un UPC-A de 12 dígitos
 * (que es un EAN-13 con un 0 adelante). Devuelve null si no se puede imprimir.
 */
export function printableEan13(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim();
  if (isValidEan13(code)) return code;
  if (/^\d{12}$/.test(code) && isValidEan13(`0${code}`)) return `0${code}`;
  return null;
}

function randomDigits(length: number): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += String(bytes[i] % 10);
  return out;
}

/** Un código nuevo con el prefijo de Pesito, que no está en `taken`. */
export function generateInternalCode(taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const base = `${INTERNAL_PREFIX}${randomDigits(9)}`;
    const code = `${base}${ean13CheckDigit(base)}`;
    if (!taken.has(code)) return code;
  }
  throw new Error("No se pudo generar un código libre.");
}

// Codificación EAN-13: cada dígito son 7 módulos (barra = 1, espacio = 0).
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
// Cuál de L/G usa cada uno de los 6 dígitos de la izquierda según el primer dígito.
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Los 95 módulos del código (string de 0 y 1). */
export function ean13Modules(code: string): string {
  if (!isValidEan13(code)) throw new Error("EAN-13 inválido");
  const parity = PARITY[Number(code[0])];
  let out = "101";
  for (let i = 0; i < 6; i++) {
    const digit = Number(code[i + 1]);
    out += parity[i] === "L" ? L[digit] : G[digit];
  }
  out += "01010";
  for (let i = 0; i < 6; i++) out += R[Number(code[i + 7])];
  out += "101";
  return out;
}
