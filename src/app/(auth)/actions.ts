"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNextPath } from "@/lib/safe-redirect";
import { recordLogin } from "@/lib/login-events";
import { MFA_COOKIE } from "@/lib/supabase/cookie-options";
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
  const next = safeNextPath(String(formData.get("next") ?? ""), "/pos");

  if (!identifier || !password) {
    return { error: "Completá tu email/usuario y tu contraseña." };
  }

  const email = isEmailIdentifier(identifier) ? identifier : usernameToEmail(identifier);
  const supabase = await createClient();
  // El contador de intentos fallidos sólo lo toca el servidor (migración
  // 0045): si se pudiera llamar con la clave pública, cualquiera podría
  // resetearlo para probar contraseñas sin límite, o bloquear cuentas ajenas.
  const admin = createAdminClient();

  const { data: lockoutRows } = await admin.rpc("check_login_lockout", { p_email: email });
  const lockout = lockoutRows?.[0];
  if (lockout?.locked) {
    const minutes = Math.max(1, Math.ceil((lockout.retry_after_seconds ?? 0) / 60));
    return {
      error: `Demasiados intentos fallidos. Probá de nuevo en ${minutes} minuto${
        minutes === 1 ? "" : "s"
      }.`,
    };
  }

  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await admin.rpc("register_login_failure", { p_email: email });
    return { error: "Email/usuario o contraseña incorrectos." };
  }

  await admin.rpc("register_login_success", { p_email: email });
  if (signIn.user) await recordLogin(signIn.user.id);

  // Con la verificación en dos pasos activada, falta el código de la app.
  // La cookie MFA_COOKIE le avisa al middleware que esta sesión la necesita
  // (la sesión en sí no guarda los factores); se borra si no hay.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasTotp = Boolean(factors?.totp.some((f) => f.status === "verified"));
  const cookieStore = await cookies();
  if (hasTotp) {
    cookieStore.set(MFA_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect(`/login/verificar?next=${encodeURIComponent(next)}`);
  }
  cookieStore.delete(MFA_COOKIE);

  redirect(next);
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password || !firstName || !lastName || !phone || !businessName) {
    return { error: "Completá todos los campos." };
  }

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        business_name: businessName,
        phone,
        first_name: firstName,
        last_name: lastName,
      },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/onboarding")}`,
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

  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
