"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { updateTicketOptions } from "@/app/(dashboard)/configuracion/actions";

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted")}
    >
      <span className={cn("absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

// Lo que lleva impreso el comprobante interno X (el ticket de una venta sin factura electrónica).
export function TicketOptions({ initialShowOrgName, initialShowNumber }: { initialShowOrgName: boolean; initialShowNumber: boolean }) {
  const [showOrgName, setShowOrgName] = useState(initialShowOrgName);
  const [showNumber, setShowNumber] = useState(initialShowNumber);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: { showOrgName: boolean; showNumber: boolean }) {
    const before = { showOrgName, showNumber };
    setShowOrgName(next.showOrgName);
    setShowNumber(next.showNumber);
    setPending(true);
    setError(null);
    const result = await updateTicketOptions(next);
    setPending(false);
    if (result.error) {
      setShowOrgName(before.showOrgName);
      setShowNumber(before.showNumber);
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-foreground">Mostrar el nombre del negocio</p>
          <p className="text-xs text-muted-foreground">Arriba del ticket.</p>
        </div>
        <Switch checked={showOrgName} disabled={pending} label="Mostrar el nombre del negocio" onChange={() => void save({ showOrgName: !showOrgName, showNumber })} />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-foreground">Mostrar el número de comprobante</p>
          <p className="text-xs text-muted-foreground">{"«X 0001-00000012». Si lo ocultás, el ticket dice sólo «Comprobante X»; el número igual queda guardado y se ve en Ventas."}</p>
        </div>
        <Switch checked={showNumber} disabled={pending} label="Mostrar el número de comprobante" onChange={() => void save({ showOrgName, showNumber: !showNumber })} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
