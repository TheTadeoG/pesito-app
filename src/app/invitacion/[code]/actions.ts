"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildFullUsername,
  generateDiscriminator,
  isValidUsernameBase,
  usernameToEmail,
} from "@/lib/internal-auth";

export interface AcceptInvitationState {
  error?: string;
  username?: string;
}

export async function acceptInvitation(code: string): Promise<AcceptInvitationState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_code: code });

  if (error) {
    if (error.message.toLowerCase().includes("expiró")) {
      return { error: "Esta invitación expiró. Pedí un link nuevo." };
    }
    if (error.message.toLowerCase().includes("usada")) {
      return { error: "Esta invitación ya fue usada." };
    }
    return { error: "No pudimos aceptar la invitación." };
  }

  redirect("/pos");
}

// Camino para quien no tiene cuenta todavía: crea una cuenta interna
// (usuario#código, sin email real) y de una acepta la invitación — pensado
// para un empleado al que invitás, no para otro dueño de negocio (ese
// sigue registrándose con su email real desde /registro).
// No redirige solo al terminar — el usuario final (con el #código) recién
// se conoce acá, y la persona lo tiene que ver y anotar antes de seguir,
// porque es lo único que le va a permitir volver a entrar.
export async function acceptInvitationAsNewUser(
  code: string,
  firstName: string,
  lastName: string,
  usernameBaseInput: string,
  password: string
): Promise<AcceptInvitationState> {
  const firstNameTrimmed = firstName.trim();
  const lastNameTrimmed = lastName.trim();
  const base = usernameBaseInput.trim().toLowerCase();

  if (!firstNameTrimmed || !lastNameTrimmed) {
    return { error: "Completá tu nombre y apellido." };
  }
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

  const { data: previewRows } = await supabase.rpc("get_invitation_preview", { p_code: code });
  const preview = previewRows?.[0];
  if (!preview || !preview.valid) {
    return { error: "Esta invitación ya fue usada, expiró o no es válida." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error: "Falta configurar el servidor para crear cuentas internas (SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

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

  const email = usernameToEmail(fullUsername);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstNameTrimmed,
      last_name: lastNameTrimmed,
      internal_username: fullUsername,
    },
  });

  if (createError || !created.user) {
    return { error: "No pudimos crear tu cuenta. Probá de nuevo." };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "No pudimos iniciar sesión con la cuenta creada. Probá de nuevo." };
  }

  const { error: acceptError } = await supabase.rpc("accept_invitation", {
    p_code: code,
    p_username: fullUsername,
  });

  if (acceptError) {
    // No dejar una cuenta huérfana sin membresía en ningún lado.
    await admin.auth.admin.deleteUser(created.user.id);
    if (acceptError.message.toLowerCase().includes("expiró")) {
      return { error: "Esta invitación expiró. Pedí un link nuevo." };
    }
    if (acceptError.message.toLowerCase().includes("usada")) {
      return { error: "Esta invitación ya fue usada." };
    }
    return { error: "No pudimos aceptar la invitación." };
  }

  return { username: fullUsername };
}
