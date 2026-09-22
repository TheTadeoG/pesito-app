"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";

export interface ActionState {
  error?: string;
}

export async function saveBrand(id: string | undefined, name: string): Promise<ActionState> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "La marca necesita un nombre." };

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  if (id) {
    const { data: existing } = await supabase
      .from("brands")
      .select("name")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("brands")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) return { error: "No pudimos guardar los cambios." };

    // products.brand guarda el nombre (no un id): renombrar la marca acá
    // debe reflejarse en los productos que ya la tenían asignada.
    if (existing && existing.name !== trimmed) {
      await supabase
        .from("products")
        .update({ brand: trimmed })
        .eq("org_id", organization.id)
        .eq("brand", existing.name);
    }
  } else {
    const { error } = await supabase
      .from("brands")
      .insert({ org_id: organization.id, name: trimmed });
    if (error) return { error: "No pudimos crear la marca." };
  }

  revalidatePath("/marcas");
  revalidatePath("/productos");
  return {};
}

export async function deleteBrand(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) return { error: "No pudimos borrar la marca." };

  revalidatePath("/marcas");
  revalidatePath("/productos");
  return {};
}
