"use server";

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
