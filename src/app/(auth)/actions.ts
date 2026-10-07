"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accountBump, accountHits, checkIpRateLimit, getClientIp, ipBump, ipHits } from "@/lib/ip-rate-limit";
import { captchaConfigured, verifyCaptcha } from "@/lib/turnstile";
import { LOGIN_FAIL_WINDOW, captchaNextTime, loginGate } from "@/lib/login-gate";
import { safeNextPath } from "@/lib/safe-redirect";
import { recordLogin } from "@/lib/login-events";
import { MFA_COOKIE } from "@/lib/supabase/cookie-options";
import { isEmailIdentifier, usernameToEmail } from "@/lib/internal-auth";

export interface AuthActionState {
  error?: string;
  info?: string;
  /** Hay que resolver el CAPTCHA para seguir (sólo cuando esta IP está forzando algo). */
  captchaRequired?: boolean;
}

// Protección sin bloquear cuentas ajenas: todo se cuenta por IP. Después de
// LOGIN_CAPTCHA_AFTER intentos fallidos seguidos desde la misma conexión (en
// 15 minutos) se pide un CAPTCHA; con LOGIN_HARD_LIMIT se corta esa conexión un
// rato. Una cuenta nunca queda bloqueada por lo que haga otra persona.
const SIGNUP_WINDOW = 10 * 60;
const SIGNUP_CAPTCHA_AFTER = 3;

async function captchaProblem(formData: FormData): Promise<string | null> {
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return "Confirmá que no sos un robot para continuar.";
  const result = await verifyCaptcha(token, await getClientIp());
  return result === "failed" ? "No pudimos verificar el CAPTCHA. Probá de nuevo." : null;
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

  // Por IP: 20 intentos por minuto (un local con varios cajeros comparte conexión).
  const ipLimit = await checkIpRateLimit("login", 20, 60);
  if (ipLimit) return { error: ipLimit };

  const email = isEmailIdentifier(identifier) ? identifier : usernameToEmail(identifier);
  const failures = await ipHits("login_fail", LOGIN_FAIL_WINDOW);
  const accountFailures = await accountHits(email, "login_fail_acct", LOGIN_FAIL_WINDOW);
  const captchaOn = captchaConfigured();
  const gate = loginGate(failures, accountFailures, captchaOn);
  if (gate === "blocked") {
    return { error: "Demasiados intentos fallidos desde tu conexión. Probá de nuevo en unos minutos." };
  }
  if (gate === "captcha") {
    const problem = await captchaProblem(formData);
    if (problem) return { error: problem, captchaRequired: true };
  }

  const supabase = await createClient();

  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await ipBump("login_fail", LOGIN_FAIL_WINDOW);
    await accountBump(email, "login_fail_acct", LOGIN_FAIL_WINDOW);
    return {
      error: "Email/usuario o contraseña incorrectos.",
      captchaRequired: captchaNextTime(failures, accountFailures, captchaOn),
    };
  }

  // Los contadores de fallos (de la IP y de la cuenta) NO se borran al entrar bien:
  // quien tenga una cuenta propia no puede resetearlos entre intento e intento.
  // Vencen solos a los 15 minutos. Nunca bloquean la cuenta: a lo sumo piden CAPTCHA.
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
  // Plan pago elegido en precios: se guarda en la cuenta para cobrarlo
  // apenas se cree el negocio (sobrevive a la confirmación por email).
  const selectedPlan = String(formData.get("plan") ?? "");
  const paidPlan = ["esencial", "pro", "ia"].includes(selectedPlan) ? selectedPlan : null;
  const selectedCycle = formData.get("cycle") === "anual" ? "anual" : "mensual";

  if (!email || !password || !firstName || !lastName || !phone || !businessName) {
    return { error: "Completá todos los campos." };
  }

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  // Por IP: 5 altas cada 10 minutos; desde la tercera, CAPTCHA.
  const ipLimit = await checkIpRateLimit("registro", 5, SIGNUP_WINDOW);
  if (ipLimit) return { error: ipLimit };
  if (captchaConfigured() && (await ipHits("registro", SIGNUP_WINDOW)) >= SIGNUP_CAPTCHA_AFTER) {
    const problem = await captchaProblem(formData);
    if (problem) return { error: problem, captchaRequired: true };
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
        ...(paidPlan ? { selected_plan: paidPlan, selected_cycle: selectedCycle } : {}),
      },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/onboarding")}`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Ya existe una cuenta con ese email. Iniciá sesión." };
    }
    const code = (error as { code?: string }).code ?? "";
    const message = error.message.toLowerCase();
    console.error("signup", code, error.message);
    if (code === "over_email_send_rate_limit" || message.includes("rate limit")) {
      return {
        error: "Se pidieron muchas cuentas en poco tiempo. Esperá unos minutos y probá de nuevo.",
      };
    }
    if (code === "email_address_invalid" || message.includes("invalid")) {
      return { error: "Ese email no es válido. Usá uno real: te mandamos un link para confirmarlo." };
    }
    if (code === "weak_password") {
      return { error: "La contraseña es muy fácil de adivinar. Probá con otra más larga." };
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
