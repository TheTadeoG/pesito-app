"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { isValidUsername, usernameToEmail } from "@/lib/internal-auth";

export interface ActionState {
  error?: string;
}

export interface InviteResult extends ActionState {
  code?: string;
}

export async function createInvitation(role: "admin" | "vendedor"): Promise<InviteResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return { error: "No tenés permiso para invitar usuarios." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_org_id: organization.id,
    p_role: role,
  });

  if (error || !data) return { error: "No pudimos crear la invitación." };

  revalidatePath("/usuarios");
  return { code: data.code };
}

export async function revokeInvitation(invitationId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return { error: "No pudimos cancelar la invitación." };

  revalidatePath("/usuarios");
  return {};
}

export async function updateMemberRole(
  membershipId: string,
  role: "admin" | "vendedor"
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member_role", {
    p_membership_id: membershipId,
    p_role: role,
  });
  if (error) return { error: "No pudimos cambiar el rol." };

  revalidatePath("/usuarios");
  return {};
}

export async function removeMember(membershipId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_membership_id: membershipId });
  if (error) return { error: "No pudimos quitar al usuario." };

  revalidatePath("/usuarios");
  return {};
}

export interface CreateDirectMemberResult extends ActionState {
  username?: string;
}

export async function createDirectMember(
  username: string,
  password: string,
  role: "admin" | "vendedor"
): Promise<CreateDirectMemberResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return { error: "No tenés permiso para crear usuarios." };
  }

  const trimmedUsername = username.trim().toLowerCase();
  if (!isValidUsername(trimmedUsername)) {
    return {
      error:
        "El usuario debe tener entre 3 y 20 caracteres: letras, números, puntos, guiones o guión bajo.",
    };
  }
  if (password.length < 4) {
    return { error: "La contraseña debe tener al menos 4 caracteres." };
  }

  const supabase = await createClient();
  const { data: available } = await supabase.rpc("username_available", {
    p_username: trimmedUsername,
  });
  if (!available) {
    return { error: "Ese usuario ya está en uso. Probá con otro." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Falta configurar el servidor para crear usuarios internos (SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(trimmedUsername),
    password,
    email_confirm: true,
    user_metadata: { internal_username: trimmedUsername },
  });

  if (createError || !created.user) {
    return { error: "No pudimos crear el usuario. Probá con otro nombre de usuario." };
  }

  const { error: membershipError } = await supabase.rpc("create_member_direct", {
    p_org_id: organization.id,
    p_user_id: created.user.id,
    p_role: role,
    p_username: trimmedUsername,
  });

  if (membershipError) {
    // No dejar una cuenta de auth huérfana (sin membresía en ninguna org).
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "No pudimos sumar el usuario a tu equipo." };
  }

  revalidatePath("/usuarios");
  return { username: trimmedUsername };
}
