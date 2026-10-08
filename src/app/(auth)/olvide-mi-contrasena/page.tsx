import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ForgotForm } from "@/app/(auth)/olvide-mi-contrasena/forgot-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Pedí un link para elegir una contraseña nueva en Pesito.",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Recuperá tu contraseña</CardTitle>
        <CardDescription>
          Escribí el email de tu cuenta y te mandamos un link para elegir una nueva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotForm />
      </CardContent>
    </Card>
  );
}
