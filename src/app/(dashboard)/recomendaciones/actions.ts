"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { isOrgAdmin } from "@/lib/roles";

export interface ApplyPricesResult {
  error?: string;
  /** Ids que quedaron con el precio nuevo. */
  applied: string[];
  failed: number;
}

/**
 * Aplica las sugerencias de precio elegidas. No revalida páginas: el
 * cliente saca de la lista lo aplicado (un revalidatePath re-renderizaría
 * la pantalla entera).
 */
export async function applyPriceSuggestions(
  items: { productId: string; price: number }[]
): Promise<ApplyPricesResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return { error: "Sólo el dueño o un administrador pueden cambiar precios.", applied: [], failed: 0 };
  }
  const supabase = await createClient();
  if (!canUse(await getSubscription(supabase, organization.id), "priceSuggestions")) {
    return { error: featureLockedMessage("priceSuggestions"), applied: [], failed: 0 };
  }
  const valid = items.filter((i) => Number.isFinite(i.price) && i.price > 0 && i.price < 100_000_000);
  if (valid.length === 0 || valid.length > 500) {
    return { error: "No hay precios para aplicar.", applied: [], failed: 0 };
  }

  const applied: string[] = [];
  let failed = 0;
  for (const item of valid) {
    const { error } = await supabase
      .from("products")
      .update({ price: item.price })
      .eq("id", item.productId)
      .eq("org_id", organization.id);
    if (error) failed += 1;
    else applied.push(item.productId);
  }
  return { applied, failed };
}

export interface RestockSettingsInput {
  targetDays: number;
  windowDays: number;
  safetyDays: number;
}

/** Guarda los ajustes de la recomendación de compra del negocio (0052). */
export async function updateRestockSettings(
  input: RestockSettingsInput
): Promise<{ error?: string }> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return { error: "Sólo el dueño o un administrador puede cambiar esto." };
  }
  const supabase = await createClient();
  if (!canUse(await getSubscription(supabase, organization.id), "restockRecommendations")) {
    return { error: featureLockedMessage("restockRecommendations") };
  }

  const { targetDays, windowDays, safetyDays } = input;
  const whole = (n: number) => Number.isInteger(n);
  if (!whole(targetDays) || targetDays < 1 || targetDays > 90) {
    return { error: "Los días de cobertura tienen que ser entre 1 y 90." };
  }
  if (!whole(windowDays) || windowDays < 7 || windowDays > 180) {
    return { error: "Los días de ventas a mirar tienen que ser entre 7 y 180." };
  }
  if (!whole(safetyDays) || safetyDays < 0 || safetyDays > 30) {
    return { error: "El colchón de seguridad tiene que ser entre 0 y 30 días." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      restock_target_days: targetDays,
      restock_window_days: windowDays,
      restock_safety_days: safetyDays,
    })
    .eq("id", organization.id);
  if (error) return { error: "No pudimos guardar los ajustes." };

  revalidatePath("/recomendaciones");
  return {};
}
