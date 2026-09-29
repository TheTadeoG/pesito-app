"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Minus, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { updateRestockSettings } from "@/app/(dashboard)/recomendaciones/actions";
import type { RestockSettings } from "@/lib/product-insights";

const EXAMPLE_PER_DAY = 1;
const EXAMPLE_LEAD = 3;
const EXAMPLE_STOCK = 2;

// Número con − y +: se ve a la legua que se puede cambiar.
function DaysStepper({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  disabled: boolean;
}) {
  const current = Number(value);
  const shown = Number.isFinite(current) ? current : min;
  const set = (n: number) => onChange(String(Math.min(max, Math.max(min, n))));
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border-2 border-primary bg-card">
      <button
        type="button"
        onClick={() => set(shown - 1)}
        disabled={disabled}
        aria-label={`Menos: ${label}`}
        className="flex h-9 w-9 items-center justify-center bg-accent text-primary hover:bg-primary/15 disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        className="h-9 w-12 bg-card text-center text-base font-extrabold text-foreground outline-none"
      />
      <span className="pr-3 text-sm text-muted-foreground">días</span>
      <button
        type="button"
        onClick={() => set(shown + 1)}
        disabled={disabled}
        aria-label={`Más: ${label}`}
        className="flex h-9 w-9 items-center justify-center bg-accent text-primary hover:bg-primary/15 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

// Línea fija con los ajustes con los que se calcula "qué pedir" y un engranaje
// que abre una ventanita (sin empujar el resto de la pantalla). Sólo quien
// administra el negocio los cambia; el resto los ve.
export function RestockSettingsBar({
  settings,
  canEdit,
}: {
  settings: RestockSettings;
  canEdit: boolean;
}) {
  const { showSuccess, showWarning } = useToast();
  const [open, setOpen] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [target, setTarget] = useState(String(settings.targetDays));
  const [window, setWindow] = useState(String(settings.windowDays));
  const [safety, setSafety] = useState(String(settings.safetyDays));
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  // Se cierra al tocar afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const num = (value: string, fallback: number) => {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) && value.trim() !== "" ? n : fallback;
  };
  const targetDays = num(target, settings.targetDays);
  const safetyDays = num(safety, settings.safetyDays);
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

  const summary = `Calculamos para tener stock para ${settings.targetDays} días después de que llegue${settings.safetyDays > 0 ? `, con ${settings.safetyDays} de reserva` : ""} · ventas de ${settings.windowDays} días`;

  return (
    <div ref={box} className="relative mt-3 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{summary}</p>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cambiar cómo se calcula"
        title="Cambiar cómo se calcula"
        aria-expanded={open}
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(28rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
          <p className="text-base font-bold text-foreground">Cómo calculamos lo que pedir</p>
          <div className="space-y-3 text-sm text-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>Stock para después de que llegue</span>
              <DaysStepper label="Días de stock después de que llegue el pedido" value={target} onChange={setTarget} min={1} max={90} disabled={!canEdit} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Reserva por si se demora o vendés más</span>
              <DaysStepper label="Días de reserva" value={safety} onChange={setSafety} min={0} max={30} disabled={!canEdit} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Ventas que miramos para el ritmo</span>
              <DaysStepper label="Días de ventas a mirar" value={window} onChange={setWindow} min={7} max={180} disabled={!canEdit} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowExample((v) => !v)}
            aria-expanded={showExample}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {showExample ? "Ocultar ejemplo" : "Ver ejemplo"}
          </button>
          {showExample && (
            <div className="rounded-xl border border-primary/20 bg-accent/50 px-4 py-3 text-sm text-foreground">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ejemplo con estos números</p>
              <p className="mt-1.5">
                {`Vendés ${EXAMPLE_PER_DAY} por día, el proveedor entrega en ${EXAMPLE_LEAD} días y tenés ${EXAMPLE_STOCK}:`}
              </p>
              <p className="mt-1.5 leading-relaxed">
                {`Cubrir ${targetDays} + ${EXAMPLE_LEAD} de espera + ${safetyDays} de reserva = ${totalDays} días`}
                <br />
                {`Necesitás ${EXAMPLE_PER_DAY} × ${totalDays} = ${need}, y tenés ${EXAMPLE_STOCK}`}
                <br />
                <span className="font-bold text-primary">{`→ Pedirías ${toBuy}`}</span>
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            El plazo de entrega se carga en cada proveedor y las unidades por bulto en cada producto.
          </p>
          {canEdit ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sólo el dueño o un administrador puede cambiar estos valores.</p>
          )}
        </div>
      )}
    </div>
  );
}
