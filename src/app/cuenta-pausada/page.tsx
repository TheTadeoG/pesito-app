import type { Metadata } from "next";
import { PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/actions";

// A dónde va un usuario pausado por el límite de usuarios del plan
// (lib/member-pause.ts). No usa requireOrgContext: justamente es lo que lo
// manda acá.

export const metadata: Metadata = {
  title: "Usuario pausado",
  robots: { index: false, follow: false },
};

export default function CuentaPausadaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <PauseCircle className="mx-auto h-12 w-12 text-warning" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tu usuario está pausado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El plan del negocio incluye menos usuarios de los que hay en el equipo, así que por ahora
            no podés entrar. Pedile al dueño que pase a un plan con más usuarios o que haga lugar en
            Usuarios. No se perdió nada: cuando se reactive tu usuario, entrás como siempre.
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
