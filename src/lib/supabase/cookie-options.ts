// Sesión persistente por el máximo que permiten los navegadores (~400 días),
// para no forzar un re-login cada vez que se cierra el navegador.
export const SESSION_COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 400,
};
