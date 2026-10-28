// Ids viejos de los planes (antes de los nombres Básico y Max): links, formularios y datos guardados en el
// navegador o en el usuario que todavía los traen. Archivo sin dependencias: lo usa también el middleware.
export function normalizePlanParam<T extends string | null | undefined>(value: T): T | string {
  return value === "esencial" ? "basico" : value === "ia" ? "max" : value;
}
