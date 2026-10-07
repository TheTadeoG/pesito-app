// Decide qué pasa con un intento de login según cuántos fallos lleva esa IP en los
// últimos 15 minutos. Sin imports: se prueba sola (login-gate.test.mts).
//   - pocos fallos: pasa normal, sin CAPTCHA;
//   - desde LOGIN_CAPTCHA_AFTER fallos: hay que resolver el CAPTCHA (si hay claves);
//   - desde LOGIN_HARD_LIMIT fallos: se corta esa conexión un rato.
// Nunca se bloquea una cuenta: todo depende de la IP de quien intenta.

export const LOGIN_FAIL_WINDOW = 15 * 60;
export const LOGIN_CAPTCHA_AFTER = 3;
export const LOGIN_HARD_LIMIT = 30;

export type LoginGate = "ok" | "captcha" | "blocked";

export function loginGate(failures: number, captchaOn: boolean): LoginGate {
  if (failures >= LOGIN_HARD_LIMIT) return "blocked";
  if (captchaOn && failures >= LOGIN_CAPTCHA_AFTER) return "captcha";
  return "ok";
}

/** Después de un intento fallido: ¿el próximo va a pedir CAPTCHA? (para mostrarlo ya). */
export function captchaNextTime(failuresBefore: number, captchaOn: boolean): boolean {
  return captchaOn && failuresBefore + 1 >= LOGIN_CAPTCHA_AFTER;
}
