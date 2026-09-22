import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignupForm } from "@/app/(auth)/registro/signup-form";

export const metadata: Metadata = {
  title: "Creá tu cuenta gratis",
  description:
    "Registrate gratis en Pesito y empezá a manejar el punto de venta, el stock y la caja de tu kiosco o almacén en minutos.",
  alternates: { canonical: "/registro" },
};

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{invite ? "Creá tu cuenta" : "Creá tu cuenta gratis"}</CardTitle>
        <CardDescription>
          {invite
            ? "Un último paso antes de sumarte al equipo."
            : "Empezá a usar Pesito en tu kiosco en minutos."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm inviteCode={invite} />
      </CardContent>
    </Card>
  );
}
