"use server";

import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { getFiadoAmountsBySale } from "@/lib/sale-payments";
import { paymentLabels } from "@/lib/payment-labels";
import { customerCode, supplierCode } from "@/lib/codes";

export interface AccountStatement {
  error?: string;
  kind?: "cliente" | "proveedor";
  name?: string;
  code?: string | null;
  contact?: string;
  /** Saldo que figura hoy en la ficha (lo que te deben o lo que le debés). */
  balance?: number;
  movements?: { date: string; label: string; cargo: number; pago: number }[];
}

const money = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

/**
 * Estado de cuenta de un cliente (ventas a fiado y cobros) o de un proveedor (compras a cuenta y pagos), para bajarlo a
 * Excel. Las anuladas no cuentan, igual que en la cuenta corriente de la ficha.
 */
export async function getAccountStatement(kind: "cliente" | "proveedor", id: string): Promise<AccountStatement> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  if (kind === "cliente") {
    const { data: c } = await supabase.from("customers").select("*").eq("org_id", organization.id).eq("id", id).maybeSingle();
    if (!c) return { error: "No encontramos al cliente." };
    const { data: salesRaw } = await supabase
      .from("sales")
      .select("id, total, created_at, status")
      .eq("org_id", organization.id)
      .eq("customer_id", id)
      .eq("status", "completada");
    const sales = salesRaw ?? [];
    const fiado = await getFiadoAmountsBySale(supabase, sales.map((s) => s.id));
    const { data: paymentsRaw } = await supabase.from("customer_payments").select("id, amount, method, created_at").eq("customer_id", id);
    return {
      kind,
      name: c.name,
      code: customerCode(c.code),
      contact: [c.phone, c.email].filter(Boolean).join(" · "),
      balance: Number(c.balance),
      movements: [
        ...sales
          .filter((s) => (fiado.get(s.id) ?? 0) > 0)
          .map((s) => ({ date: s.created_at, label: `Venta · ${money(Number(s.total))} total`, cargo: fiado.get(s.id) ?? 0, pago: 0 })),
        ...(paymentsRaw ?? []).map((p) => ({ date: p.created_at, label: `Cobro · ${paymentLabels[p.method] ?? p.method}`, cargo: 0, pago: Number(p.amount) })),
      ],
    };
  }

  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "supplierAccounts")) return { error: featureLockedMessage("supplierAccounts") };
  const { data: s } = await supabase.from("suppliers").select("*").eq("org_id", organization.id).eq("id", id).maybeSingle();
  if (!s) return { error: "No encontramos al proveedor." };
  const [{ data: purchasesRaw }, { data: paymentsRaw }] = await Promise.all([
    supabase.from("purchases").select("id, total, created_at, status, account_amount").eq("org_id", organization.id).eq("supplier_id", id).eq("status", "completada"),
    supabase.from("supplier_payments").select("id, amount, method, created_at").eq("supplier_id", id),
  ]);
  return {
    kind,
    name: s.name,
    code: supplierCode(s.code),
    contact: [s.phone, s.email].filter(Boolean).join(" · "),
    balance: Number(s.balance),
    movements: [
      ...(purchasesRaw ?? [])
        .filter((p) => Number(p.account_amount ?? 0) > 0)
        .map((p) => ({ date: p.created_at, label: `Compra · ${money(Number(p.total))} total`, cargo: Number(p.account_amount), pago: 0 })),
      ...(paymentsRaw ?? []).map((p) => ({ date: p.created_at, label: `Pago · ${paymentLabels[p.method] ?? p.method}`, cargo: 0, pago: Number(p.amount) })),
    ],
  };
}
