"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";

export interface ActionState {
  error?: string;
}

export interface CustomerFormInput {
  id?: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  notes: string;
  invoiceType: "consumidor_final" | "factura_a" | "factura_b" | "factura_c";
}

export async function saveCustomer(input: CustomerFormInput): Promise<ActionState> {
  if (!input.name.trim()) {
    return { error: "El cliente necesita un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const payload = {
    org_id: organization.id,
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    document: input.document.trim() || null,
    notes: input.notes.trim() || null,
    invoice_type: input.invoiceType,
  };

  if (input.id) {
    const { error } = await supabase.from("customers").update(payload).eq("id", input.id);
    if (error) return { error: "No pudimos guardar los cambios." };
  } else {
    const { error } = await supabase.from("customers").insert(payload);
    if (error) return { error: "No pudimos crear el cliente." };
  }

  revalidatePath("/clientes");
  if (input.id) revalidatePath(`/clientes/${input.id}`);
  revalidatePath("/pos");
  return {};
}

export async function deleteCustomer(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    return {
      error: "No pudimos borrar el cliente (puede tener ventas asociadas).",
    };
  }

  revalidatePath("/clientes");
  revalidatePath("/pos");
  return {};
}

export async function registerPayment(
  id: string,
  amount: number,
  method: "efectivo" | "tarjeta" | "transferencia" | "qr"
): Promise<ActionState> {
  if (!amount || amount <= 0) return { error: "Ingresá un monto válido." };

  const { userId } = await requireOrgContext();
  const supabase = await createClient();

  const { data: register } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (!register) {
    return { error: "Abrí tu caja para poder registrar cobros de deuda." };
  }

  const { error } = await supabase.rpc("register_customer_payment", {
    p_customer_id: id,
    p_cash_register_id: register.id,
    p_method: method,
    p_amount: amount,
  });

  if (error) return { error: "No pudimos registrar el pago." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/caja");
  revalidatePath("/pos");
  return {};
}
