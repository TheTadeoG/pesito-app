import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { Wordmark } from "@/components/marketing/wordmark";
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
        <Wordmark className="text-lg" />
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
    // Si ya hay sesión activa, lo más probable es que esta misma persona ya
    // haya usado el link con éxito (ej. volvió a tocar el link desde
    // WhatsApp, o recargó la página de éxito) — no tiene sentido mostrarle
    // un error. Buscamos su usuario para poder recordárselo (por si
    // recargó antes de anotarlo) en vez de sólo mandarla para adelante.
    if (user && preview?.org_id) {
      const { data: memberRow } = await supabase
        .from("memberships")
        .select("username")
        .eq("org_id", preview.org_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberRow?.username) {
        return (
          <Shell>
            <Card>
              <CardHeader>
                <CardTitle>Ya te sumaste a {preview.org_name}</CardTitle>
                <CardDescription>
                  Guardá tu usuario: lo vas a necesitar para iniciar sesión la próxima vez.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
                  <span className="text-sm text-muted-foreground">Tu usuario</span>
                  <span className="font-mono text-lg font-bold text-foreground">
                    {memberRow.username}
                  </span>
                </div>
                <Link
                  href="/pos"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover"
                >
                  Continuar
                </Link>
              </CardContent>
            </Card>
          </Shell>
        );
      }
    }

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
