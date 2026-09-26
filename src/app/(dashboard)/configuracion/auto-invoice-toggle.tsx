"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { updateAutoInvoiceSetting } from "@/app/(dashboard)/configuracion/actions";

export function AutoInvoiceToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    setError(null);
    const result = await updateAutoInvoiceSetting(next);
    setPending(false);
    if (result.error) {
      setEnabled(!next);
      setError(result.error);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
      <div>
        <p className="text-sm font-medium text-foreground">
          Facturación automática según medio de pago
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Con tarjeta o transferencia, sugiere Factura B en vez de Consumidor Final. Desactivada,
          las ventas no eligen ningún comprobante puntual (salvo que el cliente tenga uno fijo).
        </p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={pending}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          enabled ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
