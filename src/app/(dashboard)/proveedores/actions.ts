"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { CASH_UNAVAILABLE_ERROR, tryComputeCashOnHand } from "@/lib/caja";
import type { Json } from "@/lib/database.types";

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
  /** Plazo de pago en días ("" = sin plazo, "0" = contado). */
  paymentTermsDays: string;
  /** Ya tenía un plazo cargado (para poder borrarlo). */
  hadPaymentTerms: boolean;
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

  // Plazo de pago (0057): sólo se manda con un valor o al borrar uno cargado.
  const termsRaw = input.paymentTermsDays.trim();
  const paymentTermsDays = termsRaw === "" ? null : Number(termsRaw);
  if (
    paymentTermsDays !== null &&
    (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365)
  ) {
    return { error: "El plazo de pago tiene que ser un número de días entre 0 y 365." };
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
    ...(paymentTermsDays !== null || input.hadPaymentTerms
      ? { payment_terms_days: paymentTermsDays }
      : {}),
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

/**
 * Asigna vencimientos a varias compras de una vez. Devuelve cuántas se
 * guardaron y cuántas fallaron.
 */
export async function setPurchaseDueDates(
  entries: { purchaseId: string; dueDate: string }[]
): Promise<{ saved: number; failed: number; error?: string }> {
  if (entries.length === 0) return { saved: 0, failed: 0 };
  if (entries.length > 500) return { saved: 0, failed: 0, error: "Son demasiadas compras juntas." };
  if (entries.some((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e.dueDate))) {
    return { saved: 0, failed: 0, error: "Hay una fecha que no es válida." };
  }
  await requireOrgContext();
  const supabase = await createClient();

  let saved = 0;
  let failed = 0;
  for (let i = 0; i < entries.length; i += 10) {
    const results = await Promise.all(
      entries.slice(i, i + 10).map((e) =>
        supabase.rpc("set_purchase_due_date", { p_purchase_id: e.purchaseId, p_due_date: e.dueDate })
      )
    );
    for (const r of results) {
      if (r.error) failed += 1;
      else saved += 1;
    }
  }

  revalidatePath("/proveedores");
  revalidatePath("/proveedores/calendario");
  return { saved, failed };
}

/**
 * Paga facturas puntuales de un proveedor: cada una con su monto (nunca más
 * de lo que le falta). Los pagos sueltos de un solo monto siguen usando
 * registerSupplierPayment.
 */
export async function registerSupplierPurchasePayments(
  supplierId: string,
  allocations: { purchaseId: string; amount: number }[],
  method: string
): Promise<ActionState> {
  const clean = allocations.filter((a) => a.amount > 0);
  if (clean.length === 0) return { error: "Elegí al menos una factura y un monto." };
  const total = clean.reduce((acc, a) => acc + a.amount, 0);

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
    if (total > cashOnHand) {
      return { error: "No hay suficiente efectivo en la caja para este pago." };
    }
  }

  const { error } = await supabase.rpc("register_supplier_purchase_payments", {
    p_supplier_id: supplierId,
    p_cash_register_id: register.id,
    p_method: method,
    p_allocations: clean.map((a) => ({ purchase_id: a.purchaseId, amount: a.amount })) as unknown as Json,
  });

  if (error) {
    // PGRST202: la función no existe (falta aplicar la migración 0059).
    if (error.code === "PGRST202") {
      return { error: "Falta actualizar la base de datos (migración 0059) para pagar facturas puntuales." };
    }
    return { error: "No pudimos registrar el pago." };
  }

  revalidatePath("/proveedores");
  revalidatePath("/proveedores/calendario");
  revalidatePath("/compras");
  revalidatePath("/caja");
  return {};
}

/**
 * Anula un pago a un proveedor: vuelve la deuda y el dinero a la caja. Sólo
 * si la caja donde se registró sigue abierta (migración 0060).
 */
export async function voidSupplierPayment(paymentId: string): Promise<ActionState> {
  await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_supplier_payment", { p_payment_id: paymentId });

  if (error) {
    if (error.code === "PGRST202") {
      return { error: "Falta actualizar la base de datos (migración 0060) para anular pagos." };
    }
    if (error.message.includes("ya está cerrada")) {
      return { error: "No se puede anular: la caja donde se registró este pago ya está cerrada." };
    }
    return { error: "No pudimos anular el pago." };
  }

  revalidatePath("/proveedores");
  revalidatePath("/proveedores/calendario");
  revalidatePath("/compras");
  revalidatePath("/caja");
  return {};
}
