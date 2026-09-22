"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/app/invitacion/[code]/actions";

export function AcceptInvitationButton({ code }: { code: string }) {
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
    <div className="space-y-3">
      <Button className="w-full" onClick={handleAccept} disabled={pending}>
        {pending ? "Uniéndote…" : "Aceptar y entrar"}
      </Button>
      {error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
