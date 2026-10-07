import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const RATE_LIMITED_MESSAGE =
  "Estás haciendo demasiados pedidos seguidos. Esperá unos segundos y probá de nuevo.";

/** El error de la base por límite de ritmo (rate_limit_hit, migración 0065). */
export function isRateLimitError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "P0429";
}

/**
 * Cuenta un pedido pesado del negocio (ventana fija). Devuelve el mensaje para
 * mostrar si se pasó del límite, o null si puede seguir. Si el contador falla
 * (por ejemplo, la migración 0065 todavía no está aplicada), deja pasar: un
 * error del contador no tiene que frenar a nadie.
 */
export async function checkRateLimit(
  supabase: SupabaseClient<Database>,
  orgId: string,
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<string | null> {
  const { error } = await supabase.rpc("rate_limit_hit", {
    p_org_id: orgId,
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (!error) return null;
  if (isRateLimitError(error)) return RATE_LIMITED_MESSAGE;
  console.error("rate_limit_hit:", error.message);
  return null;
}
