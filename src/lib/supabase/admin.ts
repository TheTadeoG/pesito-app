import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Sólo para uso server-side (Server Actions/Route Handlers). La service
// role key se salta RLS por completo, así que este cliente se usa
// exclusivamente para lo que la API normal no puede hacer: crear cuentas
// de auth directamente (alta de usuarios internos por usuario/contraseña).
// Nunca importar este archivo desde un Client Component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
