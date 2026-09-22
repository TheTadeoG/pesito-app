"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { computeCashOnHand } from "@/lib/caja";
import {
  buildFullUsername,
  generateDiscriminator,
  isValidUsernameBase,
  usernameToEmail,
} from "@/lib/internal-auth";

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
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return { error: "No tenés permiso para quitar usuarios." };
  }

  const supabase = await createClient();

  const { data: memberRow } = await supabase
    .from("memberships")
    .select("id, user_id, username")
    .eq("id", membershipId)
    .eq("org_id", organization.id)
    .maybeSingle();

  if (!memberRow) return { error: "Usuario no encontrado." };

  // Si le queda una caja abierta, la cerramos antes de sacarlo del equipo:
  // si no, esa caja queda abierta para siempre (nadie más la puede cerrar)
  // y arruina los cálculos de efectivo disponible de ahí en adelante.
  const { data: openRegister } = await supabase
    .from("cash_registers")
    .select("id, opening_amount")
    .eq("org_id", organization.id)
    .eq("user_id", memberRow.user_id)
    .eq("status", "abierta")
    .maybeSingle();

  if (openRegister) {
    const openingAmount = Number(openRegister.opening_amount);
    const expectedAmount = await computeCashOnHand(supabase, openRegister.id, openingAmount);
    await supabase
      .from("cash_registers")
      .update({
        status: "cerrada",
        closing_amount: expectedAmount,
        expected_amount: expectedAmount,
        closed_at: new Date().toISOString(),
        notes: "Cerrada automáticamente al quitar al usuario del equipo.",
      })
      .eq("id", openRegister.id);
  }

  const { error } = await supabase.rpc("remove_member", { p_membership_id: membershipId });
  if (error) return { error: "No pudimos quitar al usuario." };

  // Cuenta interna (usuario#código, creada sólo para este equipo): si tras
  // esto ya no le queda ninguna membresía en ningún negocio, no dejamos la
  // cuenta viva — si no, podría loguearse igual y armarse su propio negocio
  // desde /onboarding con el mismo usuario y contraseña que vos le diste.
  if (memberRow.username) {
    try {
      const admin = createAdminClient();
      const { data: remaining } = await admin
        .from("memberships")
        .select("id")
        .eq("user_id", memberRow.user_id)
        .limit(1);

      if (!remaining || remaining.length === 0) {
        await admin.auth.admin.deleteUser(memberRow.user_id);
      }
    } catch {
      // Sin SUPABASE_SERVICE_ROLE_KEY configurada no podemos borrar la
      // cuenta de auth; el usuario ya quedó fuera del equipo igual, que es
      // lo importante — esto es sólo una limpieza extra.
    }
  }

  revalidatePath("/usuarios");
  revalidatePath("/caja");
  revalidatePath("/pos");
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

  const base = username.trim().toLowerCase();
  if (!isValidUsernameBase(base)) {
    return {
      error:
        "El usuario debe tener entre 3 y 20 caracteres: letras, números, puntos, guiones o guión bajo.",
    };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();

  // "base" puede repetirse entre distintos kioscos (le agregamos un código
  // #XXXX al estilo Discord para que el usuario final sea único de verdad).
  // Con 10.000 códigos por nombre base, un choque es rarísimo; igual
  // reintentamos unas vueltas por si acaso.
  let fullUsername: string | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = buildFullUsername(base, generateDiscriminator());
    const { data: available } = await supabase.rpc("username_available", {
      p_username: candidate,
    });
    if (available) {
      fullUsername = candidate;
      break;
    }
  }

  if (!fullUsername) {
    return { error: "No pudimos generar un usuario único. Probá de nuevo." };
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
    email: usernameToEmail(fullUsername),
    password,
    email_confirm: true,
    user_metadata: { internal_username: fullUsername },
  });

  if (createError || !created.user) {
    return { error: "No pudimos crear el usuario. Probá de nuevo." };
  }

  const { error: membershipError } = await supabase.rpc("create_member_direct", {
    p_org_id: organization.id,
    p_user_id: created.user.id,
    p_role: role,
    p_username: fullUsername,
  });

  if (membershipError) {
    // No dejar una cuenta de auth huérfana (sin membresía en ninguna org).
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "No pudimos sumar el usuario a tu equipo." };
  }

  revalidatePath("/usuarios");
  return { username: fullUsername };
}

export interface UpdateCredentialsResult extends ActionState {
  username?: string;
  password?: string;
}

// Sólo para cuentas internas (usuario#código, sin email real): las
// contraseñas nunca se guardan en texto plano en ningún lado, así que "ver
// la contraseña de nuevo" no es posible — en cambio, esto permite pisarla
// por una nueva (que sí se puede mostrar una vez, igual que al crearla).
export async function updateMemberCredentials(
  membershipId: string,
  usernameBaseInput: string,
  newPassword: string
): Promise<UpdateCredentialsResult> {
  const { membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return { error: "No tenés permiso para editar usuarios." };
  }

  const base = usernameBaseInput.trim().toLowerCase();
  if (!isValidUsernameBase(base)) {
    return {
      error:
        "El usuario debe tener entre 3 y 20 caracteres: letras, números, puntos, guiones o guión bajo.",
    };
  }
  if (newPassword && newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { data: memberRow } = await supabase
    .from("memberships")
    .select("id, user_id, username")
    .eq("id", membershipId)
    .maybeSingle();

  if (!memberRow) return { error: "Usuario no encontrado." };
  if (!memberRow.username) {
    return { error: "Sólo se puede editar usuarios internos (usuario y contraseña)." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Falta configurar el servidor para editar usuarios internos (SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const currentBase = memberRow.username.split("#")[0];
  let fullUsername = memberRow.username;

  if (base !== currentBase) {
    let candidate: string | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const c = buildFullUsername(base, generateDiscriminator());
      const { data: available } = await supabase.rpc("username_available", { p_username: c });
      if (available) {
        candidate = c;
        break;
      }
    }
    if (!candidate) return { error: "No pudimos generar un usuario único. Probá de nuevo." };
    fullUsername = candidate;

    const { error: emailError } = await admin.auth.admin.updateUserById(memberRow.user_id, {
      email: usernameToEmail(fullUsername),
    });
    if (emailError) return { error: "No pudimos actualizar el usuario." };

    const { error: usernameError } = await supabase.rpc("update_member_username", {
      p_membership_id: membershipId,
      p_username: fullUsername,
    });
    if (usernameError) return { error: "No pudimos actualizar el usuario." };
  }

  if (newPassword) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(memberRow.user_id, {
      password: newPassword,
    });
    if (passwordError) return { error: "No pudimos actualizar la contraseña." };
  }

  revalidatePath("/usuarios");
  return { username: fullUsername, password: newPassword || undefined };
}
