import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { siteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Ingresá a tu cuenta de Pesito para gestionar tu kiosco o almacén.",
  alternates: { canonical: "/login", languages: { "es-AR": `${siteUrl}/login` } },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Ingresá a tu kiosco</CardTitle>
        <CardDescription>Accedé con el email y la contraseña de tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
