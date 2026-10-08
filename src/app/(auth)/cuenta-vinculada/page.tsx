import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Cuenta vinculada",
  robots: { index: false, follow: false },
};

// Se muestra una sola vez: cuando alguien que ya tenía cuenta con email y
// contraseña entra con Google usando el mismo email y las dos quedan unidas.
export default async function LinkedAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Vinculamos tu cuenta de Google</CardTitle>
        <CardDescription>
          {`Ya tenías una cuenta de Pesito con el email ${user.email ?? "de tu Google"}. Ahora esa misma cuenta también entra con Google: tus datos son los mismos y podés usar cualquiera de las dos formas.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Link href={safeNextPath(next ?? null, "/pos")} className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover">
          Continuar
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          ¿No fuiste vos?{" "}
          <Link href="/olvide-mi-contrasena" className="font-medium text-primary hover:underline">
            Cambiá tu contraseña
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
