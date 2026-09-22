"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signup, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const initialState: AuthActionState = {};

export function SignupForm({ inviteCode }: { inviteCode?: string }) {
  const [state, formAction, pending] = useActionState(signup, initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState(false);

  if (state.info) {
    return (
      <p className="rounded-xl bg-success-bg px-3 py-3 text-sm text-success">{state.info}</p>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      e.preventDefault();
      setMismatchError(true);
      return;
    }
    setMismatchError(false);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      {inviteCode && <input type="hidden" name="inviteCode" value={inviteCode} />}

      {!inviteCode && (
        <div>
          <Label htmlFor="businessName">Nombre de tu kiosco o almacén</Label>
          <Input id="businessName" name="businessName" placeholder="Kiosco Don José" required />
          <p className="mt-1 text-xs text-muted-foreground">
            Podés cambiarlo más adelante desde Configuración.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="phone">Teléfono (opcional)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="11 2345 6789"
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword">Repetí la contraseña</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      {mismatchError && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
          Las contraseñas no coinciden.
        </p>
      )}

      {!mismatchError && state.error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creando cuenta…" : inviteCode ? "Crear cuenta y unirme" : "Crear mi cuenta gratis"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={inviteCode ? `/login?next=${encodeURIComponent(`/invitacion/${inviteCode}`)}` : "/login"}
          className="font-medium text-primary hover:underline"
        >
          Ingresá
        </Link>
      </p>
    </form>
  );
}
