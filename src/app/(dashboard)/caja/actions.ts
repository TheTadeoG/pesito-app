"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { computeCashOnHand } from "@/lib/caja";

export interface ActionState {
  error?: string;
}

export async function openCaja(openingAmount: number): Promise<ActionState> {
  if (openingAmount < 0) return { error: "El monto inicial no puede ser negativo." };

  const { organization, userId } = await requireOrgContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("org_id", organization.id)
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (existing) {
    return { error: "Ya tenés una caja abierta." };
  }

  const { error } = await supabase.from("cash_registers").insert({
    org_id: organization.id,
    user_id: userId,
    opening_amount: openingAmount,
    status: "abierta",
  });

  if (error) return { error: "No pudimos abrir la caja." };

  revalidatePath("/caja");
  revalidatePath("/pos");
  return {};
}

export async function addCashMovement(
  cashRegisterId: string,
  type: "ingreso" | "retiro",
  amount: number,
  reason: string
): Promise<ActionState> {
  if (!amount || amount <= 0) return { error: "Ingresá un monto válido." };

  const { organization, userId } = await requireOrgContext();
  const supabase = await createClient();

  if (type === "retiro") {
    const { data: register } = await supabase
      .from("cash_registers")
      .select("opening_amount")
      .eq("id", cashRegisterId)
      .single();

    if (register) {
      const cashOnHand = await computeCashOnHand(
        supabase,
        cashRegisterId,
        Number(register.opening_amount)
      );
      if (amount > cashOnHand) {
        return { error: "No podés retirar más efectivo del que hay disponible." };
      }
    }
  }

  const { error } = await supabase.from("cash_movements").insert({
    org_id: organization.id,
    cash_register_id: cashRegisterId,
    type,
    amount,
    reason: reason.trim() || null,
    user_id: userId,
  });

  if (error) return { error: "No pudimos registrar el movimiento." };

  revalidatePath("/caja");
  revalidatePath("/pos");
  return {};
}

export async function closeCaja(
  cashRegisterId: string,
  countedAmount: number
): Promise<ActionState> {
  const supabase = await createClient();

  const { data: register } = await supabase
    .from("cash_registers")
    .select("opening_amount")
    .eq("id", cashRegisterId)
    .single();

  if (!register) return { error: "No encontramos la caja." };

  const expectedAmount = await computeCashOnHand(
    supabase,
    cashRegisterId,
    Number(register.opening_amount)
  );

  const { error } = await supabase
    .from("cash_registers")
    .update({
      status: "cerrada",
      closing_amount: countedAmount,
      expected_amount: expectedAmount,
      closed_at: new Date().toISOString(),
    })
    .eq("id", cashRegisterId);

  if (error) return { error: "No pudimos cerrar la caja." };

  revalidatePath("/caja");
  revalidatePath("/pos");
  revalidatePath("/reportes");
  return {};
}
