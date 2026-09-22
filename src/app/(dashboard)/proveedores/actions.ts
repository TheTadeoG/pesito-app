"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";

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
