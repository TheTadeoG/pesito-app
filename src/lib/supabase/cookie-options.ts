// Sesión persistente por el máximo que permiten los navegadores (~400 días),
// para no forzar un re-login cada vez que se cierra el navegador.
export const SESSION_COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 400,
};

/**
 * La persona tiene activada la verificación en dos pasos: el middleware
 * manda a /login/verificar mientras la sesión no tenga el código (aal2).
 * La pone el login; la base exige el código igual (migración 0046).
 */
export const MFA_COOKIE = "pesito-mfa";
