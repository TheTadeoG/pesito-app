import { createHash } from "node:crypto";

// Partes puras del seguimiento de errores (sin base ni mail): qué se ignora, qué se borra de un
// mensaje y cómo se agrupa. Aparte de error-log.ts para poder probarlas solas.

// Ruido que no se puede accionar: redirecciones y 404 internos de Next, cortes de red y cosas del navegador.
const IGNORED = [
  /NEXT_REDIRECT/,
  /NEXT_NOT_FOUND/,
  /NEXT_HTTP_ERROR_FALLBACK/,
  /Dynamic server usage/i,
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Loading chunk .* failed/i,
  /ChunkLoadError/i,
  /Failed to fetch|NetworkError|Load failed|network error/i,
  /AbortError|The operation was aborted/i,
];

/** Saca de un texto lo que no tiene que quedar guardado (emails, tokens largos) y lo acorta. */
export function scrub(text: string, max: number): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/\b(eyJ[\w-]{10,}|[A-Za-z0-9_-]{32,})\b/g, "<token>")
    .slice(0, max);
}

function firstFrame(stack: string | undefined): string {
  const line = (stack ?? "").split("\n").find((l) => /^\s+at /.test(l)) ?? "";
  // sin números de línea ni rutas del servidor: sólo la función, para que un deploy no cambie la huella
  return line.replace(/\(.*[\\/]/, "(").replace(/:\d+:\d+\)?/g, "").trim();
}

/** Misma huella para el mismo error aunque cambien ids, números o fechas del mensaje. */
export function errorFingerprint(source: string, message: string, stack?: string): string {
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "#")
    .slice(0, 200);
  return createHash("sha1").update(`${source}|${normalized}|${firstFrame(stack)}`).digest("hex");
}

export function isIgnorableError(message: string): boolean {
  return IGNORED.some((re) => re.test(message));
}

