// Documento del cliente: tipo (por defecto CUIT), formato con guiones y control del dígito verificador.

export type DocumentType = "cuit" | "cuil" | "dni" | "pasaporte" | "cdi";

export const DOCUMENT_TYPES: { id: DocumentType; label: string; /** Código de tipo de documento de ARCA. */ arcaCode: number }[] = [
  { id: "cuit", label: "CUIT", arcaCode: 80 },
  { id: "cuil", label: "CUIL", arcaCode: 86 },
  { id: "dni", label: "DNI", arcaCode: 96 },
  { id: "pasaporte", label: "Pasaporte", arcaCode: 94 },
  { id: "cdi", label: "CDI", arcaCode: 87 },
];

export const documentTypeLabel = (type: DocumentType | null | undefined) => DOCUMENT_TYPES.find((t) => t.id === type)?.label ?? "";

/** CUIT, CUIL y CDI tienen 11 dígitos (XX-XXXXXXXX-X). */
export const isElevenDigitType = (type: DocumentType) => type === "cuit" || type === "cuil" || type === "cdi";

/** Dígito verificador del CUIT/CUIL (módulo 11). */
export function isValidCuit(raw: string): boolean {
  if (!/^\d{11}$/.test(raw)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(raw[i]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(raw[10]);
}

/** Lo que se guarda: sólo dígitos (CUIT, CUIL, CDI, DNI) o letras y números en mayúscula (pasaporte). */
export function cleanDocument(value: string, type: DocumentType): string {
  if (type === "pasaporte") return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return value.replace(/\D/g, "").slice(0, isElevenDigitType(type) ? 11 : 8);
}

/**
 * Lo que se ve y se escribe: el CUIT/CUIL/CDI lleva sus dos guiones reglamentarios, uno después de los dos primeros
 * dígitos y otro antes del último (20-12345678-9), puestos solos a medida que se escribe; los demás van sin separadores.
 */
export function formatDocument(value: string, type: DocumentType): string {
  const clean = cleanDocument(value, type);
  if (!isElevenDigitType(type)) return clean;
  if (clean.length <= 2) return clean;
  if (clean.length <= 10) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

/** Tipo más probable de un número ya cargado sin tipo. */
export function inferDocumentType(value: string | null | undefined): DocumentType {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 7 || digits.length === 8 ? "dni" : "cuit";
}

/** Error de un documento ya limpio, o null si está bien. Vacío es válido (el documento es opcional). */
export function documentError(clean: string, type: DocumentType): string | null {
  if (!clean) return null;
  if (isElevenDigitType(type)) {
    if (clean.length !== 11) return `El ${documentTypeLabel(type)} tiene 11 dígitos.`;
    if (type !== "cdi" && !isValidCuit(clean)) return `Ese ${documentTypeLabel(type)} no es válido: revisá los números.`;
    return null;
  }
  if (type === "dni") return clean.length === 7 || clean.length === 8 ? null : "El DNI tiene 7 u 8 dígitos.";
  return clean.length >= 6 ? null : "El pasaporte tiene entre 6 y 12 caracteres.";
}
