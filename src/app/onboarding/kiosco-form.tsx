"use client";

import { useState } from "react";
import { createKiosco } from "@/app/onboarding/actions";
import { businessTypes } from "@/lib/business-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { BUSINESS_NAME_MAX } from "@/lib/business-name";

export function KioscoForm({
  initialName = "",
  needsPhone = false,
}: {
  initialName?: string;
  /** Cuenta sin teléfono (por ejemplo, creada con Google): se pide junto al nombre. */
  needsPhone?: boolean;
}) {
  // El nombre ya se pidió una vez en /registro (queda guardado en el
  // usuario hasta confirmar el email). Si ya lo tenemos, no lo volvemos a
  // pedir acá: arrancamos directo en el paso del rubro.
  const [step, setStep] = useState<"nombre" | "rubro">(initialName.trim() && !needsPhone ? "rubro" : "nombre");
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("");

  async function handleSelectType(value: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await createKiosco(name, value, needsPhone ? phone : undefined);
    if (result.error) {
      setError(result.error);
      setPending(false);
    }
  }

  if (step === "nombre") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError("Ponele un nombre a tu negocio.");
            return;
          }
          if (needsPhone) {
            const typed = String(new FormData(e.currentTarget).get("phone") ?? "");
            if (typed.replace(/\D/g, "").length < 8) {
              setError("Ingresá un teléfono de contacto.");
              return;
            }
            setPhone(typed);
          }
          setError(null);
          setStep("rubro");
        }}
      >
        <div>
          <Label htmlFor="name" required>
            Nombre de tu negocio
          </Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kiosco Don José" maxLength={BUSINESS_NAME_MAX} autoFocus required />
        </div>

        {needsPhone && (
          <div>
            <Label htmlFor="phone" required>
              Teléfono
            </Label>
            <PhoneInput id="phone" name="phone" required />
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <Button type="submit" className="w-full">
          Continuar
        </Button>
      </form>
    );
  }

  const chosen = businessTypes.find((t) => t.value === type);

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Esto nos ayuda a configurar funciones específicas para{" "}
        <span className="font-medium text-foreground">{name}</span>.
      </p>

      <p className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl" aria-live="polite">
        {`Mi negocio es `}
        <span
          className={
            chosen
              ? "border-b-[3px] border-primary px-1 text-primary"
              : "border-b-[3px] border-dashed border-border px-1 text-muted-foreground"
          }
        >
          {chosen ? chosen.phrase : "…"}
        </span>
        .
      </p>

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2" role="radiogroup" aria-label="Tipo de negocio">
        {businessTypes.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            disabled={pending}
            onClick={() => setType(t.value)}
            className={`py-1 text-base underline decoration-2 underline-offset-[6px] transition-colors disabled:opacity-60 ${
              type === t.value
                ? "font-semibold text-foreground decoration-primary"
                : "text-muted-foreground decoration-border hover:text-foreground hover:decoration-primary"
            }`}
          >
            {t.label.toLowerCase()}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">¿No está tu rubro? Elegí «otro» y lo ajustamos después.</p>

      {error && (
        <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <Button type="button" className="mt-6 w-full" disabled={!type || pending} onClick={() => void handleSelectType(type)}>
        {pending ? "Creando tu negocio…" : "Seguir"}
      </Button>

      <button
        type="button"
        onClick={() => setStep("nombre")}
        className="mt-4 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Volver
      </button>
    </div>
  );
}
