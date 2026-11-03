"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessTypes } from "@/lib/business-types";

/** Rubro del negocio, que se pregunta después de pagar cuando se contrató un plan directo desde el alta. */
export async function setBusinessType(value: string): Promise<{ error?: string }> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede cambiar el rubro." };
  if (!businessTypes.some((t) => t.value === value)) return { error: "Elegí un rubro de la lista." };
  const { error } = await createAdminClient().from("organizations").update({ business_type: value }).eq("id", organization.id);
  if (error) return { error: "No pudimos guardar el rubro. Probá de nuevo." };
  revalidatePath("/", "layout");
  return {};
}
