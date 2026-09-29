"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { updateRestockSettings } from "@/app/(dashboard)/recomendaciones/actions";
import type { RestockSettings } from "@/lib/product-insights";

const EXAMPLE_PER_DAY = 1;
const EXAMPLE_LEAD = 3;
const EXAMPLE_STOCK = 2;

// Número editable dentro de la frase: "14 días".
function DaysField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  disabled: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-lg border-2 border-dashed border-primary bg-accent px-2 align-baseline font-bold text-primary">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        className="w-11 bg-transparent text-center outline-none"
      />
      <span>días</span>
    </span>
  );
}

// Los ajustes con los que se calcula "Qué comprar". Sólo quien administra
// el negocio los cambia; el resto los ve.
export function RestockSettingsPanel({
  settings,
  canEdit,
  defaultOpen = false,
}: {
  settings: RestockSettings;
  canEdit: boolean;
  /** Arranca desplegado (cuando se llega con el engranaje). */
  defaultOpen?: boolean;
}) {
  const { showSuccess, showWarning } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [target, setTarget] = useState(String(settings.targetDays));
  const [window, setWindow] = useState(String(settings.windowDays));
  const [safety, setSafety] = useState(String(settings.safetyDays));
  const [pending, startTransition] = useTransition();

  const days = (value: string, fallback: number) => {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) && value.trim() !== "" ? n : fallback;
  };
  const targetDays = days(target, settings.targetDays);
  const safetyDays = days(safety, settings.safetyDays);
  const totalDays = targetDays + EXAMPLE_LEAD + safetyDays;
  const need = EXAMPLE_PER_DAY * totalDays;
  const toBuy = Math.max(0, Math.ceil(need - EXAMPLE_STOCK));

  function save() {
    startTransition(async () => {
      const result = await updateRestockSettings({
        targetDays: Number(target),
        windowDays: Number(window),
        safetyDays: Number(safety),
      });
      if (result.error) {
        showWarning(result.error);
        return;
      }
      showSuccess("Ajustes guardados", "La recomendación ya se calculó con los valores nuevos.");
      setOpen(false);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Cómo se calcula
        </span>
        <span className="text-xs text-muted-foreground">
          {`Cobertura ${settings.targetDays} días · ventas de ${settings.windowDays} días${settings.safetyDays > 0 ? ` · colchón ${settings.safetyDays} días` : ""}`}
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <p className="text-base leading-[2.4] text-foreground">
            {"Quiero tener stock para "}
            <DaysField id="rs-target" label="Días de stock después de que llegue el pedido" value={target} onChange={setTarget} min={1} max={90} disabled={!canEdit} />
            {" después de que llegue el pedido, sumar "}
            <DaysField id="rs-safety" label="Días de reserva" value={safety} onChange={setSafety} min={0} max={30} disabled={!canEdit} />
            {" de reserva por si el proveedor se demora o vendés más, y calcular cuánto vendés por día mirando los últimos "}
            <DaysField id="rs-window" label="Días de ventas a mirar" value={window} onChange={setWindow} min={7} max={180} disabled={!canEdit} />
            {"."}
          </p>
          <div className="rounded-xl border border-primary/20 bg-accent/50 px-4 py-3 text-sm text-foreground">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ejemplo con estos números
            </p>
            <p className="mt-1.5">
              {`Un producto que vendés ${EXAMPLE_PER_DAY} por día, con un proveedor que entrega en ${EXAMPLE_LEAD} días y ${EXAMPLE_STOCK} en stock:`}
            </p>
            <p className="mt-1.5 leading-relaxed">
              {`Cubrir ${targetDays} + ${EXAMPLE_LEAD} de espera + ${safetyDays} de reserva = ${totalDays} días`}
              <br />
              {`Necesitás ${EXAMPLE_PER_DAY} × ${totalDays} = ${need}`}
              <br />
              {`Tenés ${EXAMPLE_STOCK}`}
              <br />
              <span className="font-bold text-primary">{`→ Pedirías ${toBuy}`}</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            El plazo de entrega se carga en cada proveedor, y las unidades por bulto en cada producto.
            Con eso el pedido sale en bultos enteros y te avisamos cuándo pedir.
          </p>
          {canEdit ? (
            <div className="flex justify-end">
              <Button onClick={save} disabled={pending}>
                {pending ? "Guardando…" : "Guardar ajustes"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sólo el dueño o un administrador puede cambiar estos valores.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
