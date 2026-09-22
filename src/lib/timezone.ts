// Pesito es exclusivamente para Argentina: toda fecha que se muestra o se
// usa para agrupar reportes se calcula en este huso, sin importar en qué
// huso corra el servidor (Vercel usa UTC por defecto). Argentina no
// observa horario de verano desde 2009, así que el offset es siempre -03:00.
export const ARG_TZ = "America/Argentina/Buenos_Aires";
const ARG_UTC_OFFSET = "-03:00";

/** Fecha (YYYY-MM-DD) del día en Argentina para el instante dado. */
export function argDateString(reference: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ARG_TZ }).format(reference);
}

/** Instante UTC correspondiente a la medianoche de `dateString` (YYYY-MM-DD) en Argentina. */
export function argMidnightUTC(dateString: string): Date {
  return new Date(`${dateString}T00:00:00${ARG_UTC_OFFSET}`);
}

/** Hora (0-23) de `date` según el huso horario de Argentina. */
export function argHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ARG_TZ,
      hour: "2-digit",
      hour12: false,
    }).format(date)
  );
}
