// Verificación de Cloudflare Turnstile (CAPTCHA gratis). Se pide sólo cuando una
// IP está forzando algo (ver ip-rate-limit.ts); si no hay claves configuradas,
// el CAPTCHA no se pide nunca y el resto de las protecciones siguen igual.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Hay claves de Turnstile configuradas (la pública va al navegador y la secreta queda en el servidor). */
export function captchaConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

export type CaptchaResult = "ok" | "failed" | "unavailable";

/**
 * Comprueba el token que mandó el navegador. "unavailable" = no se pudo hablar
 * con Cloudflare (se deja pasar: que se caiga un servicio de afuera no tiene
 * que dejar a nadie sin entrar; el tope por IP sigue vigente).
 */
export async function verifyCaptcha(token: string, ip: string | null): Promise<CaptchaResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return "unavailable";
  if (!token) return "failed";
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return "unavailable";
    const data = (await response.json()) as { success?: boolean };
    return data.success === true ? "ok" : "failed";
  } catch (e) {
    console.error("turnstile:", e);
    return "unavailable";
  }
}
