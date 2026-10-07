import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const IP_RATE_LIMITED_MESSAGE =
  "Hiciste demasiados intentos seguidos desde tu conexión. Esperá un minuto y probá de nuevo.";

/**
 * Límite de ritmo por IP para los formularios públicos (migración 0067). Devuelve
 * el mensaje para mostrar si se pasó, o null si puede seguir. Guarda una huella
 * (HMAC con la clave del servidor), no la IP. Si no se puede saber la IP o el
 * contador falla (por ejemplo, la migración todavía no está aplicada), deja pasar.
 */
export async function checkIpRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<string | null> {
  try {
    const h = await headers();
    const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!ip || !secret) return null;
    const key = createHmac("sha256", secret).update(ip).digest("hex");
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
