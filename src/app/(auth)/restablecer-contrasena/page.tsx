import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResetForm } from "@/app/(auth)/restablecer-contrasena/reset-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Elegí tu contraseña nueva",
  description: "Elegí una contraseña nueva para tu cuenta de Pesito.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return (
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>El link venció</CardTitle>
          <CardDescription>Los links para cambiar la contraseña duran poco y sirven una sola vez.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/olvide-mi-contrasena" className="font-medium text-primary hover:underline">
            Pedir un link nuevo
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Elegí tu contraseña nueva</CardTitle>
        <CardDescription>Usá al menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetForm />
      </CardContent>
    </Card>
  );
}
