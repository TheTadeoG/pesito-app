"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateCashCloseTime } from "@/app/(dashboard)/configuracion/actions";

const DEFAULT_TIME = "21:00";

export function CashCloseTimeForm({ initialTime }: { initialTime: string | null }) {
  const [saved, setSaved] = useState(initialTime);
  const [time, setTime] = useState(initialTime ?? DEFAULT_TIME);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = saved !== null;

  async function save(next: string | null) {
    setPending(true);
    setError(null);
    const result = await updateCashCloseTime(next);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Recordar el cierre de caja</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A quien tenga la caja abierta le aparece un aviso 15 minutos antes y a la hora de
            cierre. Si una caja queda abierta de un día para otro, se avisa siempre.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Recordar el cierre de caja"
          onClick={() => save(enabled ? null : time)}
          disabled={pending}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {enabled && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(time);
          }}
        >
          <label htmlFor="cash-close-time" className="text-sm text-muted-foreground">
            Hora de cierre
          </label>
          <Input
            id="cash-close-time"
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-32"
          />
          {time !== saved && (
            <Button type="submit" size="sm" disabled={pending}>
              Guardar
            </Button>
          )}
        </form>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
