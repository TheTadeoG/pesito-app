"use client";

import { useActionState } from "react";
import { createKiosco, type OnboardingState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: OnboardingState = {};

export function KioscoForm() {
  const [state, formAction, pending] = useActionState(createKiosco, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre del kiosco</Label>
        <Input id="name" name="name" placeholder="Kiosco Don José" autoFocus required />
      </div>

      {state.error && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creando…" : "Empezar a usar Pesito"}
      </Button>
    </form>
  );
}
