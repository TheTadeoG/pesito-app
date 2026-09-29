import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Pedidos en camino (migración 0053): lo que se le pidió a un proveedor y
// todavía no llegó. Todo es tolerante: sin la migración no hay pedidos y la
// recomendación de compra anda como antes.

export interface PendingOrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  received: number;
}

export interface PendingOrder {
  id: string;
  supplierId: string;
  createdAt: string;
  expectedAt: string | null;
  items: PendingOrderItem[];
}

/** Pedidos pendientes del negocio, con sus productos (los más viejos primero). */
export async function loadPendingOrders(
  supabase: SupabaseClient<Database>,
  orgId: string,
  supplierId?: string
): Promise<PendingOrder[]> {
  try {
    let query = supabase
      .from("restock_orders")
      .select("id, supplier_id, created_at, expected_at")
      .eq("org_id", orgId)
      .eq("status", "pendiente")
      .order("created_at", { ascending: true })
      .limit(200);
    if (supplierId) query = query.eq("supplier_id", supplierId);
    const { data: orders, error } = await query;
    if (error || !orders || orders.length === 0) return [];

    const { data: items, error: itemsError } = await supabase
      .from("restock_order_items")
      .select("id, order_id, product_id, product_name, quantity, received_quantity")
      .in("order_id", orders.map((o) => o.id))
      .limit(20000);
    if (itemsError) return [];

    return orders.map((o) => ({
      id: o.id,
      supplierId: o.supplier_id,
      createdAt: o.created_at,
      expectedAt: o.expected_at,
      items: (items ?? [])
        .filter((i) => i.order_id === o.id)
        .map((i) => ({
          id: i.id,
          productId: i.product_id,
          name: i.product_name,
          quantity: Number(i.quantity),
          received: Number(i.received_quantity),
        })),
    }));
  } catch {
    return [];
  }
}

/** ¿Ya pasó la fecha en que se esperaba el pedido? */
export function isOrderOverdue(order: PendingOrder, now: Date = new Date()): boolean {
  return order.expectedAt !== null && new Date(order.expectedAt).getTime() < now.getTime();
}

/** Cuánto falta que llegue de cada producto (suma de todos los pedidos pendientes). */
export function pendingByProduct(orders: PendingOrder[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      const remaining = item.quantity - item.received;
      if (remaining > 0) map.set(item.productId, (map.get(item.productId) ?? 0) + remaining);
    }
  }
  return map;
}

/**
 * Una compra a un proveedor descuenta lo recibido de sus pedidos pendientes
 * (del más viejo al más nuevo) y cierra los que quedaron completos. No falla
 * la compra: si algo sale mal, el pedido se cierra a mano.
 */
export async function applyPurchaseToOrders(
  supabase: SupabaseClient<Database>,
  orgId: string,
  supplierId: string,
  purchased: { product_id: string; quantity: number }[]
): Promise<void> {
  try {
    const orders = await loadPendingOrders(supabase, orgId, supplierId);
    if (orders.length === 0) return;

    const left = new Map<string, number>();
    for (const p of purchased) {
      if (p.quantity > 0) left.set(p.product_id, (left.get(p.product_id) ?? 0) + p.quantity);
    }

    for (const order of orders) {
      let complete = true;
      for (const item of order.items) {
        const remaining = item.quantity - item.received;
        const available = left.get(item.productId) ?? 0;
        const take = Math.min(remaining, available);
        if (take > 0) {
          left.set(item.productId, available - take);
          await supabase
            .from("restock_order_items")
            .update({ received_quantity: item.received + take })
            .eq("id", item.id);
        }
        if (remaining - take > 0.0005) complete = false;
      }
      if (complete) {
        await supabase
          .from("restock_orders")
          .update({ status: "recibido", closed_at: new Date().toISOString() })
          .eq("id", order.id)
          .eq("org_id", orgId);
      }
    }
  } catch {
    // Sin la migración o con un error de red: el pedido se cierra a mano.
  }
}
