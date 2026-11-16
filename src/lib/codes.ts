// Códigos internos automáticos (migración 0096): los asigna la base, por negocio y en orden de alta.

const pad = (n: number) => String(n).padStart(4, "0");

/** "PRV-0007", o null si todavía no hay código (falta la migración). */
export function supplierCode(code: number | null | undefined): string | null {
  return typeof code === "number" ? `PRV-${pad(code)}` : null;
}

/** "CLI-0012", o null si todavía no hay código (falta la migración). */
export function customerCode(code: number | null | undefined): string | null {
  return typeof code === "number" ? `CLI-${pad(code)}` : null;
}
