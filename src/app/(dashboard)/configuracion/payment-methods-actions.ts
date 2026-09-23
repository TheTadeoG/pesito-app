"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";

export interface ActionState {
  error?: string;
  success?: boolean;
  id?: string;
}

// Nombres que ya tienen un significado propio en el sistema (medios fijos
// o valores especiales como "mixto"/"fiado"/"cuenta_corriente") — no se
// puede cargar un medio personalizado que choque con ellos.
const RESERVED_NAMES = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "qr",
  "mixto",
  "fiado",
  "cuenta_corriente",
];

export async function createPaymentMethod(name: string): Promise<ActionState> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Ponele un nombre al medio de pago." };
  if (RESERVED_NAMES.includes(trimmed.toLowerCase())) {
    return { error: `"${trimmed}" ya es un medio de pago del sistema.` };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_methods")
    .insert({ org_id: organization.id, name: trimmed })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya tenés un medio de pago llamado "${trimmed}".` };
    }
    return { error: "No pudimos guardar el medio de pago." };
  }

  revalidatePath("/configuracion");
  revalidatePath("/pos");
  revalidatePath("/compras");
  return { success: true, id: data.id };
}

export async function deletePaymentMethod(id: string): Promise<ActionState> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id)
    .eq("org_id", organization.id);

  if (error) return { error: "No pudimos borrar el medio de pago." };

  revalidatePath("/configuracion");
  revalidatePath("/pos");
  revalidatePath("/compras");
  return { success: true };
}
