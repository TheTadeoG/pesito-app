"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { createKiosco } from "@/app/onboarding/actions";
import { businessTypes } from "@/lib/business-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function KioscoForm() {
  const [step, setStep] = useState<"nombre" | "rubro">("nombre");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectType(value: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await createKiosco(name, value);
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
          setError(null);
          setStep("rubro");
        }}
      >
        <div>
          <Label htmlFor="name">Nombre de tu negocio</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kiosco Don José" autoFocus required />
        </div>

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <Button type="submit" className="w-full">
          Continuar
        </Button>
      </form>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">¿Qué tipo de negocio es?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Esto nos ayuda a configurar funciones específicas.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {businessTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            disabled={pending}
            onClick={() => handleSelectType(type.value)}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-60"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <type.icon className="h-4 w-4" />
              </span>
              {type.label}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}

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
