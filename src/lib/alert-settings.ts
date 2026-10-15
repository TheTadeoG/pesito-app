import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parseAlertSettings, type AlertSettings } from "@/lib/alert-config";

/** Configuración de avisos del negocio (vacía = todo por defecto). Sólo servidor. */
export async function loadAlertSettings(supabase: SupabaseClient<Database>, orgId: string): Promise<AlertSettings> {
  const { data } = await supabase.from("alert_settings").select("settings").eq("org_id", orgId).maybeSingle();
  return parseAlertSettings(data?.settings);
}
