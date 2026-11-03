"use client";

import { useState, useTransition } from "react";
import { MailWarning } from "lucide-react";
import { resendConfirmationEmail } from "@/lib/actions/email-verification";

// Recordatorio de confirmar el email de la cuenta (se pide después de crearla, para no frenar el alta).
export function EmailVerifyBanner({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warning/40 bg-warning-bg px-4 py-2.5 text-sm text-foreground">
      <MailWarning className="h-4 w-4 shrink-0 text-warning" />
      <span className="min-w-0 flex-1">{`Confirmá tu email (${email}) para poder recuperar tu contraseña y recibir los avisos de tu cuenta.`}</span>
      {msg ? (
        <span className="text-xs text-muted-foreground">{msg}</span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await resendConfirmationEmail();
              setMsg(res.error ?? "Listo, te mandamos el email. Revisá también el spam.");
            })
          }
          className="font-medium text-primary hover:underline disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Reenviar email"}
        </button>
      )}
    </div>
  );
}
