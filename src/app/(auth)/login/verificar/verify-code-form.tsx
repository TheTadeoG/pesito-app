"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VerifyCodeForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (listError) {
      setPending(false);
      setError("Tu sesión venció. Volvé a ingresar con tu contraseña.");
      return;
    }
    if (!factor) {
      // La verificación se desactivó en el medio: no hace falta el código.
      router.replace(next);
      router.refresh();
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: code.trim(),
    });
    if (verifyError) {
      setPending(false);
      setError("El código no es correcto o ya venció. Probá con el que muestra ahora la app.");
      return;
    }
    // La sesión nueva (con el código) ya quedó en las cookies.
    router.replace(next);
    router.refresh();
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="code" required>
          Código
        </Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
          required
        />
      </div>
      {error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
        {pending ? "Verificando…" : "Verificar"}
      </Button>
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Salir e ingresar con otra cuenta
      </button>
    </form>
  );
}
