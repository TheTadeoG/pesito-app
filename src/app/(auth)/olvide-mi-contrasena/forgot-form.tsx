"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileField } from "@/components/auth/turnstile-field";

const initialState: AuthActionState = {};

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  const [email, setEmail] = useState("");
  // "Probar con otro email": vuelve al formulario sin perder el resultado anterior.
  const [again, setAgain] = useState(false);

  if (state.info && !again) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl" aria-hidden="true">
          ✉️
        </div>
        <p className="text-base font-semibold text-foreground">Revisá tu email</p>
        <p className="text-sm text-muted-foreground">
          {`Si ${email || "ese email"} tiene una cuenta, te mandamos un link para elegir una contraseña nueva. El link dura 1 hora y sirve una sola vez.`}
        </p>
        <p className="text-sm text-muted-foreground">
          ¿No lo ves? Mirá en spam o promociones. Puede tardar un par de minutos.
        </p>
        <div className="space-y-2 pt-2">
          <Button type="button" variant="outline" className="w-full" onClick={() => setAgain(true)}>
            Probar con otro email
          </Button>
          <Link href="/login" className="block text-sm font-medium text-primary hover:underline">
            Volver a ingresar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={() => setAgain(false)} className="space-y-4">
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {state.captchaRequired && <TurnstileField resetSignal={state} />}

      {state.error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p>
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
