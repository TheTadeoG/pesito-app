import type { EmailOtpType, User } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { recordLogin } from "@/lib/login-events";
import { MFA_COOKIE } from "@/lib/supabase/cookie-options";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Google sirve para crear la cuenta de un negocio y volver a entrar (o para quien
 * todavía no tiene negocio y va a crear el suyo). Si la cuenta es de un equipo
 * (usuario interno o miembro sin ser dueño de ningún negocio), se cierra la sesión.
 */
async function googleAllowed(supabase: Supabase, user: User): Promise<boolean> {
  if (typeof user.user_metadata?.internal_username === "string") return false;
  const { data: memberships } = await supabase.from("memberships").select("role").eq("user_id", user.id);
  if (!memberships || memberships.length === 0) return true;
  return memberships.some((m) => m.role === "owner");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), "/onboarding");

  const supabase = await createClient();

  // Supabase projects created with the PKCE flow send `?code=`; older/OTP
  // style confirmations send `?token_hash=&type=`. Handle both so this
  // route works regardless of the project's configured auth flow.
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;
      if (user?.identities?.some((i) => i.provider === "google")) {
        if (!(await googleAllowed(supabase, user))) {
          await supabase.auth.signOut();
          redirect("/login?error=google_solo_duenos");
        }
        await recordLogin(user.id);

        // Plan pago elegido en precios antes de venir con Google: se guarda en la
        // cuenta (igual que en el registro con email) para cobrarlo al crear el negocio.
        const plan = searchParams.get("plan");
        if (plan && ["esencial", "pro", "ia"].includes(plan) && !user.user_metadata?.selected_plan) {
          await supabase.auth.updateUser({
            data: { selected_plan: plan, selected_cycle: searchParams.get("cycle") === "anual" ? "anual" : "mensual" },
          });
        }

        // Entró con Google una persona que ya tenía cuenta con email y contraseña (mismo
        // email): Supabase unió las dos. Se le avisa una sola vez, en una pantalla aparte.
        const googleIdentity = user.identities.find((i) => i.provider === "google");
        const otherIdentity = user.identities.find((i) => i.provider !== "google");
        const justLinked =
          Boolean(googleIdentity?.created_at && otherIdentity) &&
          Date.now() - new Date(googleIdentity!.created_at!).getTime() < 2 * 60_000;
        const landing = justLinked ? `/cuenta-vinculada?next=${encodeURIComponent(next)}` : next;

        // Con la verificación en dos pasos activada falta el código de la app.
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
          redirect(`/login/verificar?next=${encodeURIComponent(landing)}`);
        }
        cookieStore.delete(MFA_COOKIE);
        redirect(landing);
      }
      redirect(next);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=confirmacion");
}
