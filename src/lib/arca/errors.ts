import { ArcaError, toArcaSafeErrorMetadata } from "facturas";

/** Mensaje para la persona; el detalle técnico va al registro del servidor, sin secretos. */
export function arcaMessage(e: unknown): string {
  if (e instanceof ArcaError) {
    console.error("arca", JSON.stringify(toArcaSafeErrorMetadata(e)));
    const code = (e as { code?: string }).code ?? "";
    if (code.includes("AUTHENTICATION")) {
      return "ARCA no aceptó el certificado. Revisá que lo hayas autorizado para el servicio «Facturación Electrónica» y que sea del entorno elegido.";
    }
    if (code.includes("TRANSPORT")) return "No pudimos comunicarnos con ARCA. Probá de nuevo en un rato.";
    return `ARCA respondió con un error (${code || "desconocido"}). ${e.message}`.slice(0, 300);
  }
  console.error("arca", e instanceof Error ? e.message : e);
  return "No pudimos completar la operación con ARCA. Probá de nuevo.";
}
