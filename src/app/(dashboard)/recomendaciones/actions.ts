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

export interface RestockOrderInput {
  supplierId: string;
  items: { productId: string; name: string; quantity: number }[];
}

/**
 * Guarda un pedido hecho a un proveedor ("Ya lo pedí"): mientras está en
 * camino, la recomendación no vuelve a sugerir esos productos.
 */
export async function createRestockOrder(input: RestockOrderInput): Promise<{ error?: string }> {
  const { organization, userId } = await requireOrgContext();
  const supabase = await createClient();
  if (!canUse(await getSubscription(supabase, organization.id), "restockRecommendations")) {
    return { error: featureLockedMessage("restockRecommendations") };
  }

  const items = input.items.filter((i) => Number.isFinite(i.quantity) && i.quantity > 0);
  if (items.length === 0 || items.length > 500) return { error: "No hay productos para el pedido." };

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", input.supplierId)
    .eq("org_id", organization.id)
    .maybeSingle();
  if (!supplier) return { error: "No encontramos al proveedor." };

  // Sólo productos del negocio.
  const ids = Array.from(new Set(items.map((i) => i.productId)));
  const valid = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("org_id", organization.id)
      .in("id", ids.slice(i, i + 100));
    for (const row of data ?? []) valid.add(row.id);
  }
  const clean = items.filter((i) => valid.has(i.productId));
  if (clean.length === 0) return { error: "No hay productos para el pedido." };

  const leadDays = supplier.lead_time_days ?? 0;
  const expectedAt = new Date(Date.now() + leadDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: order, error } = await supabase
    .from("restock_orders")
    .insert({
      org_id: organization.id,
      supplier_id: supplier.id,
      created_by: userId,
      expected_at: leadDays > 0 ? expectedAt : null,
    })
    .select("id")
    .single();
  if (error || !order) return { error: "No pudimos guardar el pedido." };

  const { error: itemsError } = await supabase.from("restock_order_items").insert(
    clean.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      product_name: i.name.slice(0, 200),
      quantity: i.quantity,
    }))
  );
  if (itemsError) {
    await supabase.from("restock_orders").delete().eq("id", order.id);
    return { error: "No pudimos guardar el pedido." };
  }

  revalidatePath("/recomendaciones");
  return {};
}

/** Cierra a mano un pedido en camino: llegó completo o se canceló. */
export async function closeRestockOrder(
  orderId: string,
  status: "recibido" | "cancelado"
): Promise<{ error?: string }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  if (status !== "recibido" && status !== "cancelado") return { error: "Estado inválido." };

  const { error } = await supabase
    .from("restock_orders")
    .update({ status, closed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("org_id", organization.id)
    .eq("status", "pendiente");
  if (error) return { error: "No pudimos actualizar el pedido." };

  revalidatePath("/recomendaciones");
  return {};
}
