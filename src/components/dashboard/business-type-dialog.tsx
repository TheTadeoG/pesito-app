"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { businessTypes } from "@/lib/business-types";
import { setBusinessType } from "@/lib/actions/business-type";

// Se pregunta después de pagar: el alta con un plan directo salta este paso para ir derecho al pago.
export function BusinessTypeDialog({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [type, setType] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = businessTypes.find((t) => t.value === type);

  async function save() {
    setPending(true);
    setError(null);
    const res = await setBusinessType(type);
    if (res.error) {
      setError(res.error);
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <Dialog open onClose={() => {}} title="¿Qué tipo de negocio es?" description={`Esto nos ayuda a configurar funciones específicas para ${businessName}.`}>
      <p className="text-3xl font-bold leading-tight text-foreground" aria-live="polite">
        {"Mi negocio es "}
        <span className={chosen ? "border-b-[3px] border-primary px-1 text-primary" : "border-b-[3px] border-dashed border-border px-1 text-muted-foreground"}>
          {chosen ? chosen.phrase : "…"}
        </span>
        .
      </p>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2" role="radiogroup" aria-label="Tipo de negocio">
        {businessTypes.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            disabled={pending}
            onClick={() => setType(t.value)}
            className={`py-1 text-base underline decoration-2 underline-offset-[6px] transition-colors disabled:opacity-60 ${
              type === t.value ? "font-semibold text-foreground decoration-primary" : "text-muted-foreground decoration-border hover:text-foreground hover:decoration-primary"
            }`}
          >
            {t.label.toLowerCase()}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="button" className="mt-6 w-full" disabled={!type || pending} onClick={() => void save()}>
        {pending ? "Guardando…" : "Seguir"}
      </Button>
    </Dialog>
  );
}
