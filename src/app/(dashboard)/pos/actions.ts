"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import {
  getSubscription,
  getMonthlySalesCount,
  hasMonthlySalesLimit,
  FREE_PLAN_MONTHLY_SALES_LIMIT,
} from "@/lib/subscription";
import type { Json } from "@/lib/database.types";
import type { SaleRow } from "@/components/dashboard/ventas-list";
import { fetchCatalogForPos, type CatalogProduct } from "@/lib/pos-catalog-server";

export interface CheckoutItemInput {
  product_id: string | null;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

export interface PaymentLineInput {
  // Puede ser un medio fijo o el nombre de un medio personalizado cargado
  // por la organización (Configuración > Medios de pago).
  method: string;
  amount: number;
}

export interface CheckoutInput {
  orgId: string;
  cashRegisterId: string;
  customerId: string | null;
  paymentMethod: string;
  discount: number;
  surcharge: number;
  invoiceType: "consumidor_final" | "factura_a" | "factura_b" | "factura_c";
  items: CheckoutItemInput[];
  // Sólo para pagos combinados (ej: parte efectivo + parte fiado). Si se
  // omite, se usa paymentMethod como único medio de pago por el total.
  payments?: PaymentLineInput[];
}

export interface CheckoutResult {
  error?: string;
  saleId?: string;
  // Lo que cambió con la venta, para que el POS se actualice sin volver a
  // renderizarse entero (eso bajaba otra vez todo el catálogo y todos los
  // clientes: ~700 KB por venta en un negocio mediano).
  stockByProduct?: Record<string, number>;
  customerBalance?: { id: string; balance: number };
  recentSales?: SaleRow[];
}

export async function checkoutSale(input: CheckoutInput): Promise<CheckoutResult> {
  if (input.items.length === 0) {
    return { error: "El carrito está vacío." };
  }

  const supabase = await createClient();

  // El Plan Gratis, una vez pasada la prueba de funciones Pro, tiene un
  // tope de ventas por mes. Se valida acá (antes de la RPC) para poder
  // devolver un mensaje claro en vez de un error genérico de base de datos.
  const subscription = await getSubscription(supabase, input.orgId);
  if (hasMonthlySalesLimit(subscription)) {
    const monthlySales = await getMonthlySalesCount(supabase, input.orgId);
    if (monthlySales >= FREE_PLAN_MONTHLY_SALES_LIMIT) {
      return {
        error: `Llegaste al límite de ${FREE_PLAN_MONTHLY_SALES_LIMIT} ventas de este mes del Plan Gratis. Pasate a un plan pago desde Configuración para seguir vendiendo sin límite.`,
      };
    }
  }

  // Una sola consulta: cobra (checkout_sale) y devuelve lo que cambió (stock de
  // la sucursal de la caja, saldo del cliente y ventas recientes de la caja).
  // Antes eran ~8 consultas más por venta (0062).
  const { data, error } = await supabase.rpc("checkout_sale_full", {
    p_org_id: input.orgId,
    p_cash_register_id: input.cashRegisterId,
    p_customer_id: input.customerId,
    p_payment_method: input.paymentMethod,
    p_discount: input.discount,
    p_items: input.items as unknown as Json,
    p_surcharge: input.surcharge,
    p_invoice_type: input.invoiceType,
    p_payments: input.payments && input.payments.length > 0 ? (input.payments as unknown as Json) : null,
  });

  if (error) {
    return { error: error.message || "No pudimos procesar la venta." };
  }

  // Sin revalidatePath: cualquier revalidatePath dentro de un server
  // action (aunque sea de otra ruta) hace que la respuesta traiga el POS
  // entero renderizado de nuevo — catálogo y clientes completos, ~700 KB
  // desde Supabase por venta. Lo que cambió se devuelve abajo. Las otras
  // pantallas del panel son dinámicas: a lo sumo muestran lo de hace 30s
  // (staleTimes en next.config.ts) si se vuelve a ellas enseguida.

  const result = (data ?? {}) as {
    sale_id?: string;
    stock?: Record<string, number | string>;
    customer_balance?: { id: string; balance: number | string } | null;
    recent?: {
      id: string;
      created_at: string;
      total: number | string;
      payment_method: string;
      invoice_type: string | null;
      customer_id: string | null;
      customer_name: string | null;
      fiado: number | string;
      items: string[];
    }[];
  };

  const productIds = Array.from(
    new Set(input.items.map((i) => i.product_id).filter((id): id is string => Boolean(id)))
  );

  return {
    saleId: result.sale_id,
    // Un producto sin fila en la sucursal quedó en 0.
    stockByProduct: {
      ...Object.fromEntries(productIds.map((id) => [id, 0])),
      ...Object.fromEntries(Object.entries(result.stock ?? {}).map(([id, stock]) => [id, Number(stock)])),
    },
    customerBalance: result.customer_balance
      ? { id: result.customer_balance.id, balance: Number(result.customer_balance.balance) }
      : undefined,
    recentSales: (result.recent ?? []).map((s) => ({
      id: s.id,
      created_at: s.created_at,
      total: Number(s.total),
      payment_method: s.payment_method,
      invoice_type: s.invoice_type ?? "consumidor_final",
      customerName: s.customer_id ? s.customer_name ?? "Cliente eliminado" : "Consumidor Final",
      itemsSummary: s.items.join(", ") || "Sin detalle",
      fiadoAmount: Number(s.fiado),
    })),
  };
}

export async function createCustomerQuick(
  name: string
): Promise<{ error?: string; id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Ingresá un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({ org_id: organization.id, name: trimmed })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No pudimos crear el cliente." };
  }


  return { id: data.id };
}

export type { CatalogProduct } from "@/lib/pos-catalog-server";

// Respaldo del catálogo del POS: si la base no responde pos_catalog (0064) desde
// el navegador, se baja por el servidor, como se hacía antes. Sólo se usa
// cuando falla el camino normal.
export async function loadCatalogFallback(
  branchId: string | null
): Promise<{ products?: CatalogProduct[]; error?: string }> {
  try {
    const { organization } = await requireOrgContext();
    const supabase = await createClient();
    return { products: await fetchCatalogForPos(supabase, organization.id, branchId) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No pudimos cargar los productos." };
  }
}
