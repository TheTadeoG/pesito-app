"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type State =
  | { kind: "loading" }
  | { kind: "off" }
  | { kind: "on"; factorId: string }
  | { kind: "enrolling"; factorId: string; qr: string; secret: string };

// Verificación en dos pasos con app de códigos (TOTP, de Supabase Auth).
// Activarla pide el código de 6 números en cada ingreso; la base no muestra
// datos del negocio hasta ingresarlo (migración 0046).
export function TwoFactorCard() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    createClient()
      .auth.mfa.listFactors()
      .then(({ data }) => {
        const verified = data?.totp.find((f) => f.status === "verified");
        setState(verified ? { kind: "on", factorId: verified.id } : { kind: "off" });
      });
  }, []);

  async function startEnroll() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    // Un alta a medias (se cerró la pantalla antes de confirmar) queda como
    // factor sin verificar: se borra antes de empezar de nuevo.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Pesito ${new Date().toISOString().slice(0, 16)}`,
      issuer: "Pesito",
    });
    setPending(false);
    if (enrollError || !data) {
      setError("No pudimos empezar la activación. Probá de nuevo en un rato.");
      return;
    }
    setState({ kind: "enrolling", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll(factorId: string) {
    setPending(true);
    setError(null);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setPending(false);
    if (verifyError) {
      setError("El código no es correcto. Probá con el que muestra ahora la app.");
      return;
    }
    setCode("");
    setState({ kind: "on", factorId });
    router.refresh();
  }

  async function disable(factorId: string) {
    if (!confirm("¿Desactivar la verificación en dos pasos? Vas a ingresar sólo con la contraseña.")) return;
    setPending(true);
    setError(null);
    const { error: unenrollError } = await createClient().auth.mfa.unenroll({ factorId });
    setPending(false);
    if (unenrollError) {
      setError("Para desactivarla, salí y volvé a ingresar con el código de la app.");
      return;
    }
    setState({ kind: "off" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Verificación en dos pasos
            {state.kind === "on" && <Badge tone="success">Activada</Badge>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Además de la contraseña, al ingresar te pide un código de tu celular (Google
            Authenticator, Authy o similar). Si alguien averigua tu contraseña, igual no puede
            entrar. Recomendada para dueños y administradores.
          </p>
        </div>
      </div>

      {state.kind === "off" && (
        <Button variant="outline" size="sm" onClick={startEnroll} disabled={pending}>
          {pending ? "Preparando…" : "Activar"}
        </Button>
      )}

      {state.kind === "on" && (
        <Button variant="outline" size="sm" onClick={() => disable(state.factorId)} disabled={pending}>
          Desactivar
        </Button>
      )}

      {state.kind === "enrolling" && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm text-foreground">
            1. Escaneá este código con tu app de códigos (o cargá la clave a mano).
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt="Código QR para la app de códigos" className="h-40 w-40 rounded-lg bg-white p-2" />
          <p className="break-all font-mono text-xs text-muted-foreground">{state.secret}</p>
          <div>
            <Label htmlFor="totp-code">2. Ingresá el código de 6 números que muestra la app</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <Button onClick={() => confirmEnroll(state.factorId)} disabled={pending || code.length !== 6}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
