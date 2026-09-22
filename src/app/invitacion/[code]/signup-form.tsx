"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { acceptInvitationAsNewUser } from "@/app/invitacion/[code]/actions";

export function InvitationSignupForm({ code }: { code: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await acceptInvitationAsNewUser(code, firstName, lastName, username, password);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.username) setCreatedUsername(result.username);
  }

  async function copyUsername() {
    if (!createdUsername) return;
    try {
      await navigator.clipboard.writeText(createdUsername);
    } catch {
      // clipboard API bloqueada: no hay mucho más que hacer.
    }
  }

  if (createdUsername) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          ¡Listo! Anotá tu usuario — junto con la contraseña que elegiste, es lo que vas a usar
          para iniciar sesión la próxima vez.
        </p>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
          <span className="text-sm text-muted-foreground">Tu usuario</span>
          <span className="font-mono text-lg font-bold text-foreground">{createdUsername}</span>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={copyUsername}>
          <Copy className="h-3.5 w-3.5" />
          Copiar usuario
        </Button>
        <Link
          href="/pos"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover"
        >
          Continuar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="inv-firstName">Nombre</Label>
          <Input
            id="inv-firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
        </div>
        <div>
          <Label htmlFor="inv-lastName">Apellido</Label>
          <Input
            id="inv-lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="inv-username">Usuario</Label>
        <Input
          id="inv-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="juan"
          required
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Sin espacios ni acentos, 3 a 20 caracteres. Te agregamos un código al final (ej.{" "}
          {username.trim() || "juan"}#4821) para que sea único.
        </p>
      </div>

      <div>
        <Label htmlFor="inv-password">Contraseña</Label>
        <PasswordInput
          id="inv-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <div>
        <Label htmlFor="inv-confirmPassword">Repetí la contraseña</Label>
        <PasswordInput
          id="inv-confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      {error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta y unirme"}
      </Button>
    </form>
  );
}
