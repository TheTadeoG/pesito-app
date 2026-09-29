"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { useToast } from "@/components/toast/toast-provider";
import { updateRestockSettings } from "@/app/(dashboard)/recomendaciones/actions";
import type { RestockSettings } from "@/lib/product-insights";

const EXAMPLE_PER_DAY = 1;
const EXAMPLE_LEAD = 3;
const EXAMPLE_STOCK = 2;

// Valor que se edita arriba, resaltado dentro del ejemplo.
function Edited({ children }: { children: ReactNode }) {
  return <b className="rounded bg-primary/15 px-1 font-extrabold text-primary">{children}</b>;
}

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
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => set(shown - 1)}
        disabled={disabled}
        aria-label={`Menos: ${label}`}
        className="flex h-8 w-8 items-center justify-center border-r border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
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
        className="h-8 w-11 bg-card text-center text-sm font-semibold tabular-nums text-foreground outline-none"
      />
      <span className="pr-2.5 text-sm text-muted-foreground">días</span>
      <button
        type="button"
        onClick={() => set(shown + 1)}
        disabled={disabled}
        aria-label={`Más: ${label}`}
        className="flex h-8 w-8 items-center justify-center border-l border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

// Línea fija arriba: los días con los que se calcula "qué pedir", editables ahí
// mismo con − y +. Se guardan solos y los pedidos se recalculan. El engranaje
// abre una ventanita (sin empujar nada) con lo menos usado y un ejemplo.
// Sólo quien administra el negocio los cambia; el resto los ve.
export function RestockSettingsBar({
  settings,
  canEdit,
}: {
  settings: RestockSettings;
  canEdit: boolean;
}) {
  const { showWarning } = useToast();
  const [showExample, setShowExample] = useState(false);
  const [target, setTarget] = useState(String(settings.targetDays));
  const [window, setWindow] = useState(String(settings.windowDays));
  const [safety, setSafety] = useState(String(settings.safetyDays));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [, startTransition] = useTransition();
  const saved = useRef(`${settings.targetDays}|${settings.windowDays}|${settings.safetyDays}`);

  // Guarda solo, medio segundo después del último cambio.
  useEffect(() => {
    if (!canEdit) return;
    const key = `${target}|${window}|${safety}`;
    if (key === saved.current) return;
    const timer = setTimeout(() => {
      setStatus("saving");
      startTransition(async () => {
        const result = await updateRestockSettings({
          targetDays: Number(target),
          windowDays: Number(window),
          safetyDays: Number(safety),
        });
        if (result.error) {
          showWarning(result.error);
          setStatus("idle");
          return;
        }
        saved.current = key;
        setStatus("saved");
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [target, window, safety, canEdit, showWarning]);

  const num = (value: string, fallback: number) => {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) && value.trim() !== "" ? n : fallback;
  };
  const targetDays = num(target, settings.targetDays);
  const safetyDays = num(safety, settings.safetyDays);
  const windowDays = num(window, settings.windowDays);
  const totalDays = targetDays + EXAMPLE_LEAD + safetyDays;
  const need = EXAMPLE_PER_DAY * totalDays;
  const toBuy = Math.max(0, Math.ceil(need - EXAMPLE_STOCK));

  const stepper = (label: string, value: string, set: (v: string) => void, shown: number, min: number, max: number) =>
    canEdit ? (
      <DaysStepper label={label} value={value} onChange={set} min={min} max={max} disabled={false} />
    ) : (
      <b>{`${shown} días`}</b>
    );
  const words = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-foreground">
      <span className="font-bold">¿Cuánto pedir?</span>
      <span>Lo suficiente para vender</span>
      {stepper("Días de venta que querés tener después de que llegue el pedido", target, setTarget, settings.targetDays, 1, 90)}
      <span>después de que llegue el pedido, más</span>
      {stepper("Días extra por si se demora", safety, setSafety, settings.safetyDays, 0, 30)}
      <span>extra por si se demora.</span>
      <span>· Miramos tus ventas de los últimos</span>
      {stepper("Días de ventas a mirar", window, setWindow, settings.windowDays, 7, 180)}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">{words}</div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-sm">
          <button
            type="button"
            onClick={() => setShowExample((v) => !v)}
            aria-expanded={showExample}
            className="whitespace-nowrap rounded-lg bg-primary/10 px-3 py-1.5 font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            {showExample ? "Ocultar ejemplo" : "Ver ejemplo"}
          </button>
          <span className="h-4 whitespace-nowrap text-xs text-muted-foreground" aria-live="polite">
            {status === "saving" ? "Guardando…" : status === "saved" ? "✓ Guardado" : ""}
          </span>
        </div>
      </div>
      {showExample && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-accent/50 px-4 py-3 text-sm text-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ejemplo con estos números</p>
          <p className="mt-1.5">
            {`Un producto que vendés ${EXAMPLE_PER_DAY} unidad por día (mirando `}
            <Edited>{`${windowDays} días`}</Edited>
            {`). El proveedor tarda ${EXAMPLE_LEAD} días en entregar y hoy te quedan ${EXAMPLE_STOCK} unidades:`}
          </p>
          <p className="mt-1.5 leading-relaxed">
            {"Te tiene que durar "}
            <Edited>{targetDays}</Edited>
            {` + ${EXAMPLE_LEAD} de espera + `}
            <Edited>{safetyDays}</Edited>
            {` extra = ${totalDays} días`}
            <br />
            {`Para vender ${totalDays} días necesitás ${need} unidades (${EXAMPLE_PER_DAY} × ${totalDays}).`}
            <br />
            {`Ya tenés ${EXAMPLE_STOCK} en stock en tu negocio, así que te faltan ${Math.max(0, need - EXAMPLE_STOCK)}.`}
            <br />
            <span className="font-bold text-primary">{`→ Pedirías ${toBuy} unidades`}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            El plazo de entrega se carga en cada proveedor y las unidades por bulto en cada producto.
          </p>
        </div>
      )}
      {!canEdit && (
        <p className="mt-2 text-xs text-muted-foreground">Sólo el dueño o un administrador puede cambiar estos valores.</p>
      )}
    </div>
  );
}
