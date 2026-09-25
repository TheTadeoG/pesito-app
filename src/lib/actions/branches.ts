"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { BRANCH_COOKIE } from "@/lib/branches";
import type { Json } from "@/lib/database.types";

export interface BranchActionState {
  error?: string;
}

async function requireManager() {
  const context = await requireOrgContext();
  const isManager = context.membership.role === "owner" || context.membership.role === "admin";
  return { ...context, isManager };
}

// Los mensajes de las funciones de la base ya están en castellano y pensados
// para mostrarse; el resto se reemplaza por uno genérico.
function friendly(message: string | undefined, fallback: string) {
  if (!message) return fallback;
  const known = [
    "plan Pro",
    "ya hay una sucursal",
    "ponele un nombre",
    "no hay stock suficiente",
    "elegí dos sucursales",
    "no tiene productos",
    "mayor a cero",
    "no tenés permiso",
  ];
  if (known.some((k) => message.includes(k))) {
    return message.charAt(0).toUpperCase() + message.slice(1) + ".";
  }
  return fallback;
}

/** Dueños/administradores: sucursal en la que trabajan (menú lateral). */
export async function setCurrentBranch(branchId: string): Promise<BranchActionState> {
  const { organization, isManager } = await requireManager();
  if (!isManager) return { error: "Tu sucursal la asigna el dueño del negocio." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("org_id", organization.id)
    .eq("id", branchId)
    .maybeSingle();
  if (!data) return { error: "No encontramos esa sucursal." };

  const cookieStore = await cookies();
  cookieStore.set(BRANCH_COOKIE, branchId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return {};
}

export async function createBranch(name: string): Promise<BranchActionState> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_branch", {
    p_org_id: organization.id,
    p_name: name,
  });
  if (error) return { error: friendly(error.message, "No pudimos crear la sucursal.") };
  revalidatePath("/configuracion");
  return {};
}

export async function renameBranch(branchId: string, name: string): Promise<BranchActionState> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Ponele un nombre a la sucursal." };
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .update({ name: trimmed })
    .eq("id", branchId)
    .eq("org_id", organization.id)
    .select("id");
  if (error) {
    return {
      error: error.code === "23505" ? "Ya hay una sucursal con ese nombre." : "No pudimos guardar el nombre.",
    };
  }
  if (!data || data.length === 0) return { error: "No tenés permiso para renombrar sucursales." };
  revalidatePath("/configuracion");
  return {};
}

export async function setMemberBranch(
  membershipId: string,
  branchId: string | null
): Promise<BranchActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_branch", {
    p_membership_id: membershipId,
    p_branch_id: branchId,
  });
  if (error) return { error: friendly(error.message, "No pudimos cambiar la sucursal.") };
  revalidatePath("/usuarios");
  return {};
}

export async function transferStock(
  fromBranchId: string,
  toBranchId: string,
  items: { product_id: string; quantity: number }[],
  note: string
): Promise<BranchActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock", {
    p_from_branch_id: fromBranchId,
    p_to_branch_id: toBranchId,
    p_items: items as unknown as Json,
    p_note: note.trim() || null,
  });
  if (error) return { error: friendly(error.message, "No pudimos hacer la transferencia.") };
  revalidatePath("/productos");
  return {};
}
