"use server";

import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

/** Qué pasos del onboarding ya hizo el negocio (se cuenta con lo que hay cargado, no con clics). */
export interface OnboardingProgress {
  product: boolean;
  cashOpened: boolean;
  sale: boolean;
  purchase: boolean;
  customer: boolean;
  cashClosed: boolean;
}

/**
 * Seis consultas de conteo (sin traer filas) cada vez que se pide. Sólo la usa el aviso de
 * "Primeros pasos". Con `since` (cuando la persona reinicia la guía) cuenta únicamente lo que se
 * hizo desde ese momento, así los pasos arrancan pendientes aunque el negocio ya tenga todo
 * cargado. No revalida páginas (el POS no se vuelve a pintar).
 */
export async function getOnboardingProgress(since?: string | null): Promise<OnboardingProgress | null> {
  try {
    const { organization } = await requireOrgContext();
    const supabase = await createClient();
    const from = since && !Number.isNaN(new Date(since).getTime()) ? new Date(since).toISOString() : null;
    const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
      const { count: n, error } = await query;
      if (error) throw new Error(error.message);
      return (n ?? 0) > 0;
    };
    const head = { count: "exact", head: true } as const;
    const org = organization.id;
    const [product, cashOpened, sale, purchase, customer, cashClosed] = await Promise.all([
      count(from ? supabase.from("products").select("id", head).eq("org_id", org).gte("created_at", from) : supabase.from("products").select("id", head).eq("org_id", org)),
      count(from ? supabase.from("cash_registers").select("id", head).eq("org_id", org).gte("opened_at", from) : supabase.from("cash_registers").select("id", head).eq("org_id", org)),
      count(from ? supabase.from("sales").select("id", head).eq("org_id", org).gte("created_at", from) : supabase.from("sales").select("id", head).eq("org_id", org)),
      count(from ? supabase.from("purchases").select("id", head).eq("org_id", org).gte("created_at", from) : supabase.from("purchases").select("id", head).eq("org_id", org)),
      count(from ? supabase.from("customers").select("id", head).eq("org_id", org).gte("created_at", from) : supabase.from("customers").select("id", head).eq("org_id", org)),
      count(
        from
          ? supabase.from("cash_registers").select("id", head).eq("org_id", org).eq("status", "cerrada").gte("closed_at", from)
          : supabase.from("cash_registers").select("id", head).eq("org_id", org).eq("status", "cerrada")
      ),
    ]);
    return { product, cashOpened, sale, purchase, customer, cashClosed };
  } catch (e) {
    console.error("getOnboardingProgress", e);
    return null;
  }
}
