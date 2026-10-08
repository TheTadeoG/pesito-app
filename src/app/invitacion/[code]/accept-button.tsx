"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { acceptInvitation, signOutForInvitation } from "@/app/invitacion/[code]/actions";

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? "Cerrando sesión…" : "No soy yo: cerrar sesión y crear mi usuario"}
    </Button>
  );
}

/**
 * Hay una sesión abierta en este navegador. Se avisa con qué cuenta y se deja
 * elegir: sumarla al equipo, o cerrar sesión y crear el usuario del equipo
 * (para un empleado que abre el link en un equipo donde quedó otra sesión).
 * Una cuenta de Google no se suma a un equipo: sólo queda cerrar sesión.
 */
export function AcceptInvitationButton({
  code,
  email,
  isGoogle,
  hasOtherBusiness,
}: {
  code: string;
  email: string | null;
  isGoogle: boolean;
  /** La cuenta ya pertenece a otro negocio (una cuenta, un negocio). */
  hasOtherBusiness: boolean;
}) {
  const canAccept = !isGoogle && !hasOtherBusiness;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setPending(true);
    setError(null);
    const result = await acceptInvitation(code);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm text-muted-foreground">
        {email ? `Tenés la sesión abierta con ${email}.` : "Tenés una sesión abierta en este navegador."}
        {isGoogle
          ? " Es una cuenta de Google, que no se usa para sumarse a un equipo."
          : hasOtherBusiness
            ? " Esa cuenta ya pertenece a otro negocio, y una cuenta no puede estar en dos. Para sumarte a este equipo, cerrá sesión y creá tu usuario."
            : " Si es tu cuenta, podés sumarla al equipo; si no, cerrá sesión y creá tu usuario."}
      </p>

      {canAccept && (
        <Button className="w-full" onClick={handleAccept} disabled={pending}>
          {pending ? "Uniéndote…" : "Aceptar con esta cuenta"}
        </Button>
      )}

      <form action={signOutForInvitation.bind(null, code)}>
        <SignOutButton />
      </form>

      {error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
