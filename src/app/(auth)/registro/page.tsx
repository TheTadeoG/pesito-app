import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignupForm } from "@/app/(auth)/registro/signup-form";

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
