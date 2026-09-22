"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEmailIdentifier, usernameToEmail } from "@/lib/internal-auth";

export interface AuthActionState {
  error?: string;
  info?: string;
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/pos";

  if (!identifier || !password) {
    return { error: "Completá tu email/usuario y tu contraseña." };
  }

  const email = isEmailIdentifier(identifier) ? identifier : usernameToEmail(identifier);
  const supabase = await createClient();

  const { data: lockoutRows } = await supabase.rpc("check_login_lockout", { p_email: email });
  const lockout = lockoutRows?.[0];
  if (lockout?.locked) {
    const minutes = Math.max(1, Math.ceil((lockout.retry_after_seconds ?? 0) / 60));
    return {
      error: `Demasiados intentos fallidos. Probá de nuevo en ${minutes} minuto${
        minutes === 1 ? "" : "s"
      }.`,
    };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await supabase.rpc("register_login_failure", { p_email: email });
    return { error: "Email/usuario o contraseña incorrectos." };
  }

  await supabase.rpc("register_login_success", { p_email: email });

  redirect(next);
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  // Con invitación el negocio ya existe: no pedimos nombre de negocio y, al
  // confirmar la cuenta, se acepta la invitación en vez de armar una nueva.
  const businessName = String(formData.get("businessName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password || (!inviteCode && !businessName)) {
    return { error: "Completá todos los campos." };
  }

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const postSignupPath = inviteCode ? `/invitacion/${inviteCode}` : "/onboarding";
  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { business_name: businessName || null, phone: phone || null },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(postSignupPath)}`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Ya existe una cuenta con ese email. Iniciá sesión." };
    }
    return { error: "No pudimos crear tu cuenta. Intentá de nuevo." };
  }

  if (!data.session) {
    return {
      info: "Te enviamos un email para confirmar tu cuenta. Revisá tu bandeja de entrada.",
    };
  }

  redirect(postSignupPath);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
