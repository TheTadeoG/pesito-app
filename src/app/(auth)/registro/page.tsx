import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignupForm } from "@/app/(auth)/registro/signup-form";

export const metadata: Metadata = {
  title: "Creá tu cuenta gratis",
  description:
    "Registrate gratis en Pesito y empezá a manejar el punto de venta, el stock y la caja de tu kiosco o almacén en minutos.",
  alternates: { canonical: "/registro" },
};

export default function RegistroPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Creá tu cuenta gratis</CardTitle>
        <CardDescription>Empezá a usar Pesito en tu kiosco en minutos.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
