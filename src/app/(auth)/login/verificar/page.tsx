import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VerifyCodeForm } from "@/app/(auth)/login/verificar/verify-code-form";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Verificación en dos pasos",
  robots: { index: false, follow: false },
};

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Verificación en dos pasos</CardTitle>
        <CardDescription>
          Abrí tu app de códigos (Google Authenticator, Authy o similar) e ingresá el código de 6
          números de Pesito.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyCodeForm next={safeNextPath(next, "/pos")} />
      </CardContent>
    </Card>
  );
}
