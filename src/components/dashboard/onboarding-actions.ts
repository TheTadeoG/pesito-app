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
 * "Primeros pasos", que se muestra a los negocios nuevos mientras no terminaron. No revalida
 * páginas (el POS no se vuelve a pintar).
 */
export async function getOnboardingProgress(): Promise<OnboardingProgress | null> {
  try {
    const { organization } = await requireOrgContext();
    const supabase = await createClient();
    const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
      const { count: n, error } = await query;
      if (error) throw new Error(error.message);
      return (n ?? 0) > 0;
    };
    const head = { count: "exact", head: true } as const;
    const [product, cashOpened, sale, purchase, customer, cashClosed] = await Promise.all([
      count(supabase.from("products").select("id", head).eq("org_id", organization.id)),
      count(supabase.from("cash_registers").select("id", head).eq("org_id", organization.id)),
      count(supabase.from("sales").select("id", head).eq("org_id", organization.id)),
      count(supabase.from("purchases").select("id", head).eq("org_id", organization.id)),
      count(supabase.from("customers").select("id", head).eq("org_id", organization.id)),
      count(supabase.from("cash_registers").select("id", head).eq("org_id", organization.id).eq("status", "cerrada")),
    ]);
    return { product, cashOpened, sale, purchase, customer, cashClosed };
  } catch (e) {
    console.error("getOnboardingProgress", e);
    return null;
  }
}
