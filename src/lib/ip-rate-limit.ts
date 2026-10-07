import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const IP_RATE_LIMITED_MESSAGE =
  "Hiciste demasiados intentos seguidos desde tu conexión. Esperá un minuto y probá de nuevo.";

/** IP de quien hace el pedido (Vercel la manda en x-real-ip / x-forwarded-for). */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

// Huella: HMAC con la clave del servidor, no el dato en sí (IP o email).
function fingerprint(value: string): string | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value || !secret) return null;
  return createHmac("sha256", secret).update(value).digest("hex");
}

async function ipKey(): Promise<string | null> {
  const ip = await getClientIp();
  return ip ? fingerprint(ip) : null;
}

/**
 * Límite de ritmo por IP para los formularios públicos (migración 0067). Devuelve
 * el mensaje para mostrar si se pasó, o null si puede seguir. Si no se puede saber
 * la IP o el contador falla (por ejemplo, la migración todavía no está aplicada),
 * deja pasar.
 */
export async function checkIpRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<string | null> {
  try {
    const key = await ipKey();
    if (!key) return null;
    const { data, error } = await createAdminClient().rpc("rate_limit_ip", {
      p_key: key,
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate_limit_ip:", error.message);
      return null;
    }
    return data === false ? IP_RATE_LIMITED_MESSAGE : null;
  } catch (e) {
    console.error("rate_limit_ip:", e);
    return null;
  }
}

/** Cuántos pedidos lleva esta IP en ese tipo, dentro de la ventana (0 si no se sabe). Migración 0068. */
export async function ipHits(bucket: string, windowSeconds: number): Promise<number> {
  try {
    const key = await ipKey();
    if (!key) return 0;
    const { data, error } = await createAdminClient().rpc("ip_hits", {
      p_key: key,
      p_bucket: bucket,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("ip_hits:", error.message);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("ip_hits:", e);
    return 0;
  }
}

/** Suma un pedido a esta IP en ese tipo (sin cortar a nadie: sólo cuenta). */
export async function ipBump(bucket: string, windowSeconds: number): Promise<void> {
  try {
    const key = await ipKey();
    if (!key) return;
    const { error } = await createAdminClient().rpc("rate_limit_ip", {
      p_key: key,
      p_bucket: bucket,
      p_max: 1_000_000,
      p_window_seconds: windowSeconds,
    });
    if (error) console.error("ip_bump:", error.message);
  } catch (e) {
    console.error("ip_bump:", e);
  }
}

// --- Contadores por cuenta (sólo para pedir CAPTCHA, nunca para bloquear) ---

const accountKey = (email: string) => fingerprint(`acct:${email.trim().toLowerCase()}`);

/** Fallos recientes de esa cuenta, sumando todas las IP (0 si no se sabe). */
export async function accountHits(email: string, bucket: string, windowSeconds: number): Promise<number> {
  try {
    const key = accountKey(email);
    if (!key) return 0;
    const { data, error } = await createAdminClient().rpc("ip_hits", {
      p_key: key,
      p_bucket: bucket,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("account_hits:", error.message);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("account_hits:", e);
    return 0;
  }
}

export async function accountBump(email: string, bucket: string, windowSeconds: number): Promise<void> {
  try {
    const key = accountKey(email);
    if (!key) return;
    const { error } = await createAdminClient().rpc("rate_limit_ip", {
      p_key: key,
      p_bucket: bucket,
      p_max: 1_000_000,
      p_window_seconds: windowSeconds,
    });
    if (error) console.error("account_bump:", error.message);
  } catch (e) {
    console.error("account_bump:", e);
  }
}
