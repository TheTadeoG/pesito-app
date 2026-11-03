import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MIN_PHONE_DIGITS, phoneDigits } from "@/lib/phone-countries";
import { signOut } from "@/app/(auth)/actions";
import { KioscoForm } from "@/app/onboarding/kiosco-form";
import { TrackEvent } from "@/components/track-event";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/pos");
  }

  // Cuenta interna (usuario#código, sin email real): se creó para sumarse
  // al equipo de otro negocio, no para arrancar uno propio.
  if (typeof user.user_metadata?.internal_username === "string") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Esta cuenta no puede crear un negocio</CardTitle>
            <CardDescription>
              Tu usuario se creó como parte del equipo de otro negocio. Si dejaste de trabajar ahí
              y ya no tenés acceso, pedile a quien te dio de alta que te reincorpore, o registrate
              con tu propio email en /registro si querés armar tu propio negocio.
            </CardDescription>
          </CardHeader>
        </Card>
        <form action={signOut}>
          <button type="submit" className="text-sm font-medium text-muted-foreground underline hover:text-foreground">
            Cerrar sesión
          </button>
        </form>
      </div>
    );
  }

  const initialName =
    typeof user.user_metadata?.business_name === "string" ? user.user_metadata.business_name : "";
  // El registro con email ya pidió el teléfono; con Google se pide acá.
  // También si el que quedó guardado no sirve (cuentas creadas cuando se podían escribir letras).
  const needsPhone =
    typeof user.user_metadata?.phone !== "string" || phoneDigits(user.user_metadata.phone) < MIN_PHONE_DIGITS;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Creá tu cuenta</CardTitle>
          <CardDescription>
            Último paso: contanos sobre tu negocio para configurar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrackEvent event="sign_up" params={{ method: user.identities?.some((i) => i.provider === "google") ? "google" : "email" }} dedupeKey="sign_up" />
          <KioscoForm initialName={initialName} needsPhone={needsPhone} />
        </CardContent>
      </Card>
      <form action={signOut}>
        <button type="submit" className="text-sm font-medium text-muted-foreground underline hover:text-foreground">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
