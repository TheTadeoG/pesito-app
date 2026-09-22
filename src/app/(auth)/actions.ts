"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthActionState {
  error?: string;
  info?: string;
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/pos";

  if (!email || !password) {
    return { error: "Completá tu email y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

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

  if (!email || !password || (!inviteCode && !businessName)) {
    return { error: "Completá todos los campos." };
  }

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
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
