"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function updateOrganizationName(name: string): Promise<ActionState> {
  if (!name.trim()) return { error: "El nombre no puede estar vacío." };

  const { organization } = await requireOrgContext();
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
