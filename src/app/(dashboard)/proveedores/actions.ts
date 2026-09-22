"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { computeCashOnHand } from "@/lib/caja";

export interface ActionState {
  error?: string;
}

export interface SupplierFormInput {
  id?: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export async function saveSupplier(input: SupplierFormInput): Promise<ActionState> {
  if (!input.name.trim()) {
    return { error: "El proveedor necesita un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const payload = {
    org_id: organization.id,
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    notes: input.notes.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase.from("suppliers").update(payload).eq("id", input.id);
    if (error) return { error: "No pudimos guardar los cambios." };
  } else {
    const { error } = await supabase.from("suppliers").insert(payload);
    if (error) return { error: "No pudimos crear el proveedor." };
  }

  revalidatePath("/proveedores");
  revalidatePath("/compras");
  return {};
}

export async function deleteSupplier(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { error: "No pudimos borrar el proveedor." };

  revalidatePath("/proveedores");
  revalidatePath("/compras");
  return {};
}

export async function registerSupplierPayment(
  id: string,
  amount: number,
  method: "efectivo" | "tarjeta" | "transferencia" | "qr"
): Promise<ActionState> {
  if (!amount || amount <= 0) return { error: "Ingresá un monto válido." };

  const { userId } = await requireOrgContext();
  const supabase = await createClient();

  const { data: register } = await supabase
    .from("cash_registers")
    .select("id, opening_amount")
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (!register) {
    return { error: "Abrí tu caja para poder registrar pagos a proveedores." };
  }

  if (method === "efectivo") {
    const cashOnHand = await computeCashOnHand(supabase, register.id, Number(register.opening_amount));
    if (amount > cashOnHand) {
      return { error: "No hay suficiente efectivo en la caja para este pago." };
    }
  }

  const { error } = await supabase.rpc("register_supplier_payment", {
    p_supplier_id: id,
    p_cash_register_id: register.id,
    p_method: method,
    p_amount: amount,
  });

  if (error) return { error: "No pudimos registrar el pago." };

  revalidatePath("/proveedores");
  revalidatePath("/compras");
  revalidatePath("/caja");
  return {};
}
