/**
 * Destino de un "?next=" sólo si es una ruta interna. Un valor como
 * https://otro-sitio.com o //otro-sitio convertiría el login (o el link del
 * mail) en un redirector a cualquier web.
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
