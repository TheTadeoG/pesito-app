/**
 * Largo máximo del nombre del negocio: es lo que entra en las 2 líneas del
 * encabezado del menú lateral (con el logo al lado). Los nombres más largos
 * que ya existían se siguen mostrando (se cortan con "…" a las 2 líneas).
 */
export const BUSINESS_NAME_MAX = 30;

export const BUSINESS_NAME_TOO_LONG = `El nombre puede tener hasta ${BUSINESS_NAME_MAX} caracteres.`;
