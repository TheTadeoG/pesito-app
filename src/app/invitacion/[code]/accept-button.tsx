"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { acceptInvitation, signOutForInvitation } from "@/app/invitacion/[code]/actions";

function SignOutButton({ primary }: { primary: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={primary ? "primary" : "outline"} className="w-full" disabled={pending}>
      {pending ? "Cerrando sesión…" : "Cerrar sesión y crear mi usuario y contraseña"}
    </Button>
  );
}

/**
 * Hay una sesión abierta en este navegador. Los empleados entran con usuario y
 * contraseña propios (no con Google). Se avisa con qué cuenta se está y se deja
 * elegir: sumarla al equipo (sólo una cuenta con email y sin otro negocio), o
 * cerrar sesión y crear el usuario con contraseña.
 */
export function AcceptInvitationButton({
  code,
  email,
  orgName,
  isGoogle,
  hasOtherBusiness,
}: {
  code: string;
  email: string | null;
  orgName: string;
  isGoogle: boolean;
  /** La cuenta ya pertenece a otro negocio (una cuenta, un negocio). */
  hasOtherBusiness: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAccept = !isGoogle && !hasOtherBusiness;

  async function handleAccept() {
    setPending(true);
    setError(null);
    const result = await acceptInvitation(code);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl bg-muted/60 px-3.5 py-3 text-sm text-muted-foreground">
        <p>{email ? `Tenés la sesión abierta con ${email}.` : "Tenés una sesión abierta en este navegador."}</p>
        {isGoogle ? (
          <p>
            Las cuentas de Google sirven sólo para registrar un negocio, no para los usuarios que forman
            parte de un equipo. Para sumarte a {orgName} tenés que entrar con un <strong>usuario y una
            contraseña</strong> propios.
          </p>
        ) : hasOtherBusiness ? (
          <p>
            Esa cuenta ya está registrada en <strong>otro negocio distinto</strong> de {orgName}, y cada
            cuenta puede pertenecer a un solo negocio. Para sumarte a {orgName} tenés que entrar con un{" "}
            <strong>usuario y una contraseña</strong> propios.
          </p>
        ) : (
          <p>
            Esta cuenta todavía no pertenece a ningún negocio. Podés sumarla al equipo de {orgName}, o
            cerrar sesión y crear un <strong>usuario y una contraseña</strong> propios.
          </p>
        )}
      </div>

      {canAccept && (
        <Button className="w-full" onClick={handleAccept} disabled={pending}>
          {pending ? "Uniéndote…" : "Aceptar con esta cuenta"}
        </Button>
      )}

      <form action={signOutForInvitation.bind(null, code)}>
        <SignOutButton primary={!canAccept} />
      </form>

      {error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
