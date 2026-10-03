"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { CASH_UNAVAILABLE_ERROR, tryComputeCashOnHand } from "@/lib/caja";

export interface ActionState {
  error?: string;
}

export interface SupplierFormInput {
  id?: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  /** Días que tarda en llegar un pedido ("" = no se sabe). */
  leadTimeDays: string;
  /** Ya tenía un plazo cargado (para poder borrarlo). */
  hadLeadTime: boolean;
  /** Pedido mínimo en pesos ("" = sin mínimo). */
  minOrderAmount: string;
  /** Ya tenía un mínimo cargado (para poder borrarlo). */
  hadMinOrder: boolean;
  /** Días de entrega: 0 = lunes ... 6 = domingo. */
  deliveryDays: number[];
  /** Ya tenía días de entrega cargados (para poder borrarlos). */
  hadDeliveryDays: boolean;
}

export async function saveSupplier(input: SupplierFormInput): Promise<ActionState> {
  if (!input.name.trim()) {
    return { error: "El proveedor necesita un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  // Plazo de entrega (0052): sólo se manda si hay un valor o si se está
  // borrando uno cargado, así guardar un proveedor sigue andando sin la migración.
  const leadRaw = input.leadTimeDays.trim();
  const leadTimeDays = leadRaw === "" ? null : Number(leadRaw);
  if (leadTimeDays !== null && (!Number.isInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 90)) {
    return { error: "El plazo de entrega tiene que ser un número de días entre 0 y 90." };
  }

  // Pedido mínimo (0054): mismo criterio que el plazo, sólo se manda con un
  // valor o al borrar uno cargado.
  const minRaw = input.minOrderAmount.trim().replace(",", ".");
  const minOrderAmount = minRaw === "" ? null : Number(minRaw);
  if (minOrderAmount !== null && (!Number.isFinite(minOrderAmount) || minOrderAmount < 0 || minOrderAmount > 1_000_000_000)) {
    return { error: "El pedido mínimo tiene que ser un monto válido." };
  }

  // Días de entrega (0056): mismo criterio, sólo se manda con valores o al borrarlos.
  const deliveryDays = Array.from(new Set(input.deliveryDays)).sort((a, b) => a - b);
  if (deliveryDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { error: "Los días de entrega no son válidos." };
  }

  const payload = {
    org_id: organization.id,
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    notes: input.notes.trim() || null,
    ...(leadTimeDays !== null || input.hadLeadTime ? { lead_time_days: leadTimeDays } : {}),
    ...(minOrderAmount !== null || input.hadMinOrder ? { min_order_amount: minOrderAmount } : {}),
    ...(deliveryDays.length > 0 || input.hadDeliveryDays ? { delivery_days: deliveryDays } : {}),
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
  method: string
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
    const cashOnHand = await tryComputeCashOnHand(supabase, register.id, Number(register.opening_amount));
    if (cashOnHand === null) return { error: CASH_UNAVAILABLE_ERROR };
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

/** Carga o cambia el vencimiento de una compra a cuenta (null = sin fecha). */
export async function setPurchaseDueDate(
  purchaseId: string,
  dueDate: string | null
): Promise<ActionState> {
  if (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { error: "Elegí una fecha válida." };
  }
  await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_purchase_due_date", {
    p_purchase_id: purchaseId,
    p_due_date: dueDate,
  });
  if (error) return { error: "No pudimos guardar el vencimiento." };

  revalidatePath("/proveedores");
  revalidatePath("/proveedores/calendario");
  return {};
}
