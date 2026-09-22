import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { roleLabels } from "@/lib/roles";
import { AcceptInvitationButton } from "@/app/invitacion/[code]/accept-button";
import { InvitationSignupForm } from "@/app/invitacion/[code]/signup-form";

export const metadata: Metadata = {
  title: "Invitación",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Banknote className="h-5 w-5" />
        </span>
        <span className="text-lg">Pesito</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: preview } = await supabase
    .rpc("get_invitation_preview", { p_code: code })
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!preview || !preview.valid) {
    // Si ya hay una sesión activa, lo más probable es que esta misma
    // persona ya haya usado el link con éxito (ej. volvió a entrar al
    // link desde WhatsApp, o recargó la página de éxito) — no tiene
    // sentido mostrarle un error, la mandamos directo a donde ya entró.
    if (user) {
      redirect("/pos");
    }

    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Invitación no disponible</CardTitle>
            <CardDescription>
              Este link ya fue usado, expiró o no es válido. Pedile a quien te invitó que te mande
              uno nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  const roleLabel = roleLabels[preview.role as "admin" | "vendedor"];

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>Te invitaron a {preview.org_name}</CardTitle>
          <CardDescription>Vas a sumarte con el rol de {roleLabel}.</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <AcceptInvitationButton code={code} />
          ) : (
            <div className="space-y-4">
              <InvitationSignupForm code={code} />
              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tenés cuenta?{" "}
                <Link
                  href={`/login?next=${encodeURIComponent(`/invitacion/${code}`)}`}
                  className="font-medium text-primary hover:underline"
                >
                  Ingresá
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
