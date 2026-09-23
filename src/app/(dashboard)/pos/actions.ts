"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { getSubscription, getMonthlySalesCount, FREE_PLAN_MONTHLY_SALES_LIMIT } from "@/lib/subscription";
import type { Json } from "@/lib/database.types";

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

export async function checkoutSale(
  input: CheckoutInput
): Promise<{ error?: string; saleId?: string }> {
  if (input.items.length === 0) {
    return { error: "El carrito está vacío." };
  }

  const supabase = await createClient();

  // El Plan Gratis, una vez pasada la prueba de funciones Pro, tiene un
  // tope de ventas por mes. Se valida acá (antes de la RPC) para poder
  // devolver un mensaje claro en vez de un error genérico de base de datos.
  const subscription = await getSubscription(supabase, input.orgId);
  if (!subscription.hasProAccess) {
    const monthlySales = await getMonthlySalesCount(supabase, input.orgId);
    if (monthlySales >= FREE_PLAN_MONTHLY_SALES_LIMIT) {
      return {
        error: `Llegaste al límite de ${FREE_PLAN_MONTHLY_SALES_LIMIT} ventas de este mes del Plan Gratis. Pasate a un plan pago desde Configuración para seguir vendiendo sin límite.`,
      };
    }
  }

  const { data, error } = await supabase.rpc("checkout_sale", {
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

  revalidatePath("/pos");
  revalidatePath("/productos");
  revalidatePath("/caja");
  revalidatePath("/reportes");
  revalidatePath("/clientes");
  if (input.customerId) revalidatePath(`/clientes/${input.customerId}`);

  return { saleId: data ?? undefined };
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

  revalidatePath("/pos");
  revalidatePath("/clientes");

  return { id: data.id };
}
