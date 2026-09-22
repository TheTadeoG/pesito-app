// Dominio inventado para las cuentas de "usuario interno" (usuario +
// contraseña, dadas de alta directamente por el dueño/admin para sus
// vendedores, sin depender de un email real). Supabase Auth necesita algo
// con forma de email; nunca se le manda un correo de verdad a este dominio.
const INTERNAL_LOGIN_DOMAIN = "vendedores.pesito.app";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${INTERNAL_LOGIN_DOMAIN}`;
}

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}
