"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileField } from "@/components/auth/turnstile-field";

const initialState: AuthActionState = {};

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" required />
      </div>

      {state.captchaRequired && <TurnstileField resetSignal={state} />}

      {state.error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.info && (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground" role="status">
          {state.info}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Si entrás con usuario (por ejemplo juan#4821), pedile al dueño del negocio que te cambie la contraseña desde Usuarios.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </form>
  );
}
