import { createAdminClient } from "@/lib/supabase/admin";

export interface LandingStats {
  kioscos: number;
  ventas: number;
  monto: number;
}

// Contador real para la landing: cuenta lo que ya sabe el sistema
// (organizaciones dadas de alta, ventas completadas en toda la plataforma)
// y le suma el offset que carga un admin desde /admin — para incluir
// números reales que el sistema todavía no ve. Usa la service role porque
// es un conteo de TODA la plataforma, no de una org puntual: ninguna
// policy de RLS deja ver eso desde el cliente anon/authenticated.
const EMPTY_STATS: LandingStats = { kioscos: 0, ventas: 0, monto: 0 };

// Si falta configurar la service role (build local sin secrets, o un error
// transitorio) el contador simplemente no se muestra (ver Stats) en vez de
// tirar abajo la landing entera.
export async function getLandingStats(): Promise<LandingStats> {
  try {
    const admin = createAdminClient();

    const [{ count: orgCount }, { count: salesCount }, { data: sales }, { data: settings }] =
      await Promise.all([
        admin.from("organizations").select("id", { count: "exact", head: true }),
        admin
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("status", "completada"),
        admin.from("sales").select("total").eq("status", "completada"),
        admin.from("landing_stats").select("*").eq("id", "main").maybeSingle(),
      ]);

    const montoSistema = (sales ?? []).reduce((acc, s) => acc + Number(s.total), 0);

    return {
      kioscos: (orgCount ?? 0) + (settings?.kioscos_offset ?? 0),
      ventas: (salesCount ?? 0) + (settings?.ventas_offset ?? 0),
      monto: montoSistema + Number(settings?.monto_offset ?? 0),
    };
  } catch {
    return EMPTY_STATS;
  }
}
