"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast/toast-provider";
import { updateRestockSettings } from "@/app/(dashboard)/recomendaciones/actions";
import type { RestockSettings } from "@/lib/product-insights";

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
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="rs-target">Días de venta a cubrir</Label>
              <Input
                id="rs-target"
                type="number"
                min={1}
                max={90}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={!canEdit}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Cuántos días de venta querés tener cuando llega el pedido.
              </p>
            </div>
            <div>
              <Label htmlFor="rs-window">Días de ventas a mirar</Label>
              <Input
                id="rs-window"
                type="number"
                min={7}
                max={180}
                value={window}
                onChange={(e) => setWindow(e.target.value)}
                disabled={!canEdit}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Con cuántos días hacia atrás se calcula lo que vendés por día.
              </p>
            </div>
            <div>
              <Label htmlFor="rs-safety">Colchón de seguridad (días)</Label>
              <Input
                id="rs-safety"
                type="number"
                min={0}
                max={30}
                value={safety}
                onChange={(e) => setSafety(e.target.value)}
                disabled={!canEdit}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Días de sobra por si el proveedor se demora o vendés más.
              </p>
            </div>
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
