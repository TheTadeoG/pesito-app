"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { normalizeCloseTime } from "@/lib/cash-reminder";
import { BUSINESS_NAME_MAX, BUSINESS_NAME_TOO_LONG } from "@/lib/business-name";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function updateOrganizationName(name: string): Promise<ActionState> {
  if (!name.trim()) return { error: "El nombre no puede estar vacío." };

  const { organization } = await requireOrgContext();
  // Un nombre más largo que ya existía se puede dejar igual; uno nuevo, no.
  if (name.trim().length > BUSINESS_NAME_MAX && name.trim() !== organization.name) {
    return { error: BUSINESS_NAME_TOO_LONG };
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from("organizations")
    .update({ name: name.trim() })
    .eq("id", organization.id);

  if (error) return { error: "No pudimos guardar el cambio." };

  revalidatePath("/configuracion");
  revalidatePath("/pos");
  return { success: true };
}

export async function updateAutoInvoiceSetting(enabled: boolean): Promise<ActionState> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("organizations")
    .update({ auto_invoice_by_payment: enabled })
    .eq("id", organization.id);

  if (error) return { error: "No pudimos guardar el cambio." };

  revalidatePath("/configuracion");
  revalidatePath("/pos");
  return { success: true };
}

/** Hora de cierre ("HH:MM", Argentina) para recordar cerrar la caja; null la desactiva. */
export async function updateCashCloseTime(time: string | null): Promise<ActionState> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return { error: "Sólo el dueño o un administrador puede cambiar esto." };
  }
  const value = time === null ? null : normalizeCloseTime(time);
  if (time !== null && !value) return { error: "Elegí una hora válida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ cash_close_time: value })
    .eq("id", organization.id);

  if (error) return { error: "No pudimos guardar el cambio." };

  revalidatePath("/configuracion");
  return { success: true };
}
