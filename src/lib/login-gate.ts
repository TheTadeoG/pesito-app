// Decide qué pasa con un intento de login. Sin imports: se prueba sola
// (login-gate.test.mts).
//   - por IP (últimos 15 minutos): desde LOGIN_CAPTCHA_AFTER fallos seguidos se pide
//     CAPTCHA; desde LOGIN_HARD_LIMIT se corta esa conexión un rato;
//   - por cuenta (últimos 15 minutos, sumando todas las IP): desde
//     ACCOUNT_CAPTCHA_AFTER fallos se pide CAPTCHA a cualquiera que intente entrar
//     a esa cuenta (cubre un ataque repartido en muchas IP).
// Una cuenta NUNCA se bloquea: lo peor que le pasa a su dueño es resolver un CAPTCHA.

export const LOGIN_FAIL_WINDOW = 15 * 60;
export const LOGIN_CAPTCHA_AFTER = 3;
export const LOGIN_HARD_LIMIT = 30;
export const ACCOUNT_CAPTCHA_AFTER = 10;

export type LoginGate = "ok" | "captcha" | "blocked";

export function loginGate(ipFailures: number, accountFailures: number, captchaOn: boolean): LoginGate {
  if (ipFailures >= LOGIN_HARD_LIMIT) return "blocked";
  if (captchaOn && (ipFailures >= LOGIN_CAPTCHA_AFTER || accountFailures >= ACCOUNT_CAPTCHA_AFTER)) return "captcha";
  return "ok";
}

/** Después de un intento fallido: ¿el próximo va a pedir CAPTCHA? (para mostrarlo ya). */
export function captchaNextTime(ipFailuresBefore: number, accountFailuresBefore: number, captchaOn: boolean): boolean {
  return (
    captchaOn &&
    (ipFailuresBefore + 1 >= LOGIN_CAPTCHA_AFTER || accountFailuresBefore + 1 >= ACCOUNT_CAPTCHA_AFTER)
  );
}
