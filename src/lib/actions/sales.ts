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
}

export async function getSaleDetail(
  saleId: string
): Promise<{ error?: string; sale?: SaleDetail }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("sales")
    .select(
      "id, created_at, status, payment_method, invoice_type, subtotal, discount, surcharge, total, customer_id"
    )
    .eq("id", saleId)
    .eq("org_id", organization.id)
    .maybeSingle();

  if (!sale) return { error: "No encontramos la venta." };

  const [{ data: itemsRaw }, { data: customerRaw }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("product_name, quantity, unit_price, subtotal")
      .eq("sale_id", saleId),
    sale.customer_id
      ? supabase.from("customers").select("name").eq("id", sale.customer_id).maybeSingle()
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
    },
  };
}

export async function voidSale(saleId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: saleId });

  if (error) {
    return { error: error.message || "No pudimos anular la venta." };
  }

  revalidatePath("/reportes");
  revalidatePath("/inventario");
  revalidatePath("/productos");
  revalidatePath("/pos");
  revalidatePath("/clientes");
  revalidatePath("/caja");

  return {};
}
