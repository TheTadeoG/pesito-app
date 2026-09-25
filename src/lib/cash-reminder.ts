import { argDateString, argMidnightUTC } from "@/lib/timezone";

// Cuántos minutos antes de la hora de cierre se empieza a avisar.
export const CLOSE_SOON_MINUTES = 15;

export type CashReminder =
  /** La caja sigue abierta desde un día anterior (con o sin hora de cierre). */
  | { kind: "stale"; openedDate: string }
  /** Falta poco para la hora de cierre. */
  | { kind: "soon"; closeTime: string; minutesLeft: number }
  /** Ya pasó la hora de cierre de hoy. */
  | { kind: "closing"; closeTime: string };

/** "21:00:00" o "21:00" → "21:00"; null si no es una hora válida. */
export function normalizeCloseTime(value: string | null | undefined): string | null {
  const match = value?.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : null;
}

/**
 * Qué recordar sobre una caja abierta en `now`. Una caja abierta después de
 * la hora de cierre (turno noche) no avisa hasta el día siguiente, cuando
 * pasa a "stale".
 */
export function getCashReminder(
  openedAt: string,
  closeTime: string | null,
  now: Date = new Date()
): CashReminder | null {
  const today = argDateString(now);
  const openedDate = argDateString(new Date(openedAt));
  if (openedDate < today) return { kind: "stale", openedDate };

  const time = normalizeCloseTime(closeTime);
  if (!time) return null;

  const [hours, minutes] = time.split(":").map(Number);
  const closeAt = argMidnightUTC(today).getTime() + (hours * 60 + minutes) * 60 * 1000;
  if (new Date(openedAt).getTime() >= closeAt) return null;

  const minutesLeft = Math.ceil((closeAt - now.getTime()) / (60 * 1000));
  if (minutesLeft <= 0) return { kind: "closing", closeTime: time };
  if (minutesLeft <= CLOSE_SOON_MINUTES) return { kind: "soon", closeTime: time, minutesLeft };
  return null;
}
