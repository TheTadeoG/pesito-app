// Dominio inventado para las cuentas de "usuario interno" (usuario +
// contraseña, dadas de alta directamente por el dueño/admin para sus
// vendedores, sin depender de un email real). Supabase Auth necesita algo
// con forma de email; nunca se le manda un correo de verdad a este dominio.
const INTERNAL_LOGIN_DOMAIN = "vendedores.pesito.app";

// El usuario final (el que se usa para loguearse) tiene forma "juan#4821":
// un código de 4 dígitos que el sistema agrega solo, al estilo Discord. Así
// dos kioscos distintos pueden tener cada uno un "juan" sin chocar entre sí
// — el dueño no tiene que andar buscando un nombre libre.
const DISCRIMINATOR_SEPARATOR = "#";

export function usernameToEmail(fullUsername: string): string {
  // "#" es válido en la parte local de un email por RFC, pero mejor no
  // depender de eso: lo cambiamos por "." antes de armar el email interno.
  const local = fullUsername.trim().toLowerCase().replaceAll(DISCRIMINATOR_SEPARATOR, ".");
  return `${local}@${INTERNAL_LOGIN_DOMAIN}`;
}

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

const USERNAME_BASE_PATTERN = /^[a-z0-9._-]{3,20}$/;

/** Valida sólo la parte que el dueño escribe (sin el código #XXXX). */
export function isValidUsernameBase(base: string): boolean {
  return USERNAME_BASE_PATTERN.test(base);
}

export function generateDiscriminator(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export function buildFullUsername(base: string, discriminator: string): string {
  return `${base}${DISCRIMINATOR_SEPARATOR}${discriminator}`;
}
