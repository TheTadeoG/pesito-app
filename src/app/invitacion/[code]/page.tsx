import Link from "next/link";
import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { roleLabels } from "@/lib/roles";
import { AcceptInvitationButton } from "@/app/invitacion/[code]/accept-button";

export const metadata: Metadata = {
  title: "Invitación",
  robots: { index: false, follow: false },
};

const primaryLinkClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover";
const outlineLinkClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted";

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

  if (!preview || !preview.valid) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
            <div className="space-y-2">
              <Link href={`/registro?invite=${code}`} className={primaryLinkClass}>
                Crear cuenta y unirme
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(`/invitacion/${code}`)}`}
                className={outlineLinkClass}
              >
                Ya tengo cuenta
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
