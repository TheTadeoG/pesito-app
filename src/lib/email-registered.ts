import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ¿Ya hay una cuenta con ese email? (migración 0070). Si no se puede saber
 * (la migración todavía no está aplicada, la base no responde), devuelve false
 * y el registro sigue como siempre.
 */
export async function emailRegistered(email: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("email_registered", { p_email: email });
    if (error) {
      console.error("email_registered:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("email_registered:", e);
    return false;
  }
}
