"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";

const initialState: AuthActionState = {};

const URL_ERRORS: Record<string, string> = {
  google_solo_duenos:
    "Ingresar con Google es sólo para dueños de un negocio. Si sos parte de un equipo, entrá con tu usuario (o email) y contraseña.",
  google: "No pudimos abrir Google. Probá de nuevo o entrá con tu email y contraseña.",
  confirmacion: "El link venció o ya se usó. Pedí uno nuevo o ingresá con tu email y contraseña.",
  demasiados: "Hiciste demasiados intentos seguidos. Esperá un minuto y probá de nuevo.",
};

export function LoginForm({
  next,
  restablecida,
  errorCode,
}: {
  next?: string;
  restablecida?: boolean;
  errorCode?: string;
}) {
  const [state, formAction, pending] = useActionState(login, initialState);

  const urlError = errorCode ? URL_ERRORS[errorCode] : undefined;

  return (
    <div className="space-y-4">
      <GoogleButton next={next} />
      <OrDivider />
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />

      {urlError && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {urlError}
        </p>
      )}

      {restablecida && (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground" role="status">
          Listo, cambiaste tu contraseña. Ingresá con la nueva.
        </p>
      )}

      <div>
        <Label htmlFor="identifier" required>
          Email o usuario
        </Label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          placeholder="tu@email.com o juan#4821"
          required
        />
      </div>

      <div>
        <Label htmlFor="password" required>
          Contraseña
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </div>

      <p className="-mt-2 text-right text-sm">
        <Link href="/olvide-mi-contrasena" className="text-muted-foreground hover:text-primary hover:underline">
          Olvidé mi contraseña
        </Link>
      </p>

      {state.captchaRequired && <TurnstileField resetSignal={state} />}

      {state.error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-medium text-primary hover:underline">
          Creá tu kiosco
        </Link>
      </p>
    </form>
    </div>
  );
}
