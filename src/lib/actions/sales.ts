"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";

export interface ActionState {
  error?: string;
}

export interface SaleDetailItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SalePaymentLine {
  method: string;
  amount: number;
}

export interface SaleVoucherInfo {
  kind: "invoice" | "credit_note" | "debit_note";
  status: string;
  voucherClass: string | null;
  salesPoint: number | null;
  number: number | null;
  cae: string | null;
  caeExpiry: string | null;
  environment: "test" | "production";
}

export interface SaleDetail {
  id: string;
  created_at: string;
  status: string;
  payment_method: string;
  invoice_type: string;
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  customerName: string;
  items: SaleDetailItem[];
  payments: SalePaymentLine[];
  /** Quién, cuándo y por qué se anuló (la venta nunca se borra). */
  voided: { at: string; by: string | null; reason: string | null } | null;
  /** Comprobantes electrónicos de ARCA de esta venta (factura y notas de crédito). */
  vouchers: SaleVoucherInfo[];
}

export async function getSaleDetail(
  saleId: string
): Promise<{ error?: string; sale?: SaleDetail }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("sales")
    .select(
      "id, created_at, status, payment_method, invoice_type, subtotal, discount, surcharge, total, customer_id, voided_at, voided_by, void_reason"
    )
    .eq("id", saleId)
    .eq("org_id", organization.id)
    .maybeSingle();

  if (!sale) return { error: "No encontramos la venta." };

  const [{ data: itemsRaw }, { data: customerRaw }, { data: paymentsRaw }, { data: voucherRows }, { data: voider }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("product_name, quantity, unit_price, subtotal")
      .eq("sale_id", saleId),
    sale.customer_id
      ? supabase.from("customers").select("name").eq("id", sale.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("sale_payments").select("method, amount").eq("sale_id", saleId),
    supabase
      .from("arca_vouchers")
      .select("kind, status, voucher_class, sales_point, number, cae, cae_expiry, environment")
      .eq("sale_id", saleId)
      .order("created_at"),
    sale.voided_by
      ? supabase.from("memberships").select("username, email").eq("org_id", organization.id).eq("user_id", sale.voided_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    sale: {
      id: sale.id,
      created_at: sale.created_at,
      status: sale.status,
      payment_method: sale.payment_method,
      invoice_type: sale.invoice_type,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      surcharge: Number(sale.surcharge),
      total: Number(sale.total),
      customerName: customerRaw?.name ?? "Consumidor Final",
      items: (itemsRaw ?? []).map((i) => ({
        product_name: i.product_name,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        subtotal: Number(i.subtotal),
      })),
      // Ventas de antes de que existiera sale_payments (o de un único
      // medio) no tienen filas acá: el diálogo cae de vuelta a mostrar
      // sólo payment_method en ese caso.
      payments: (paymentsRaw ?? []).map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
      voided: sale.voided_at ? { at: sale.voided_at, by: voider?.username ?? voider?.email ?? null, reason: sale.void_reason } : sale.status === "anulada" ? { at: "", by: null, reason: null } : null,
      vouchers: (voucherRows ?? []).map((v) => ({
        kind: v.kind,
        status: v.status,
        voucherClass: v.voucher_class,
        salesPoint: v.sales_point,
        number: v.number,
        cae: v.cae,
        caeExpiry: v.cae_expiry,
        environment: v.environment,
      })),
    },
  };
}

/**
 * Anula una venta (nunca se borra): repone el stock, ajusta caja y cuenta del cliente, y deja quién, cuándo y
 * por qué. Sólo dueño o administrador. Con factura electrónica hace falta una nota de crédito.
 */
export async function voidSale(saleId: string, reason: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale_audited", { p_sale_id: saleId, p_reason: reason });

  if (error) {
    return { error: error.message || "No pudimos anular la venta." };
  }

  revalidatePath("/ventas");
  revalidatePath("/reportes");
  revalidatePath("/productos");
  revalidatePath("/pos");
  revalidatePath("/clientes");
  revalidatePath("/caja");

  return {};
}
