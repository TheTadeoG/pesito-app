"use client";

import { useMemo, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PlanLockNote, PlanPill } from "@/components/dashboard/pro-locked-card";
import { ALERT_DEFS, FIXED_MODULES, MODULE_NOTE, alertEnabled, alertValue, type AlertDef, type AlertSettings } from "@/lib/alert-config";
import { MODULE_LABEL, type AlertModule } from "@/lib/bell-alerts";
import type { Plan } from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { saveAlertSettings } from "@/app/(dashboard)/alertas/actions";

const MODULES: AlertModule[] = ["productos", "caja", "proveedores", "clientes"];

/**
 * Configuración → Avisos: por módulo, cuáles avisos están prendidos y con qué umbral. Cada
 * interruptor y cada número se guardan juntos con "Guardar". Lo que el plan no incluye se
 * muestra igual, con el plan que lo desbloquea.
 */
export function AlertSettingsManager({
  initial,
  canConfigure,
  featureLocks,
}: {
  initial: AlertSettings;
  /** El plan incluye configurar los avisos (Esencial en adelante). */
  canConfigure: boolean;
  /** Plan que desbloquea cada aviso (null si ya lo tiene). */
  featureLocks: Record<string, Plan | null>;
}) {
  const [settings, setSettings] = useState<AlertSettings>(initial);
  const [saved, setSaved] = useState<AlertSettings>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  function patch(id: string, change: { enabled?: boolean; value?: number }) {
    setDone(false);
    setSettings((s) => ({ ...s, [id]: { ...s[id], ...change } }));
  }

  async function save() {
    setPending(true);
    setError(null);
    const res = await saveAlertSettings(settings);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(settings);
    setDone(true);
  }

  function Row({ def }: { def: AlertDef }) {
    const lock = def.feature ? featureLocks[def.id] : null;
    const disabled = !canConfigure || Boolean(lock);
    const enabled = alertEnabled(settings, def.id);
    return (
      <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            {def.label}
            {lock && <PlanPill plan={lock} />}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
          {def.param && enabled && !lock && (
            <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {def.param.label}
              {def.param.options ? (
                <span className="inline-block w-28">
                  <Select
                    value={alertValue(settings, def.id)}
                    disabled={disabled}
                    onChange={(e) => patch(def.id, { value: Number(e.target.value) })}
                    className="h-8 rounded-lg px-2 text-xs"
                    aria-label={def.param.label}
                  >
                    {def.param.options.map((o) => (
                      <option key={o} value={o}>{`${o} ${def.param!.unit}`}</option>
                    ))}
                  </Select>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={def.param.min}
                    max={def.param.max}
                    value={alertValue(settings, def.id)}
                    disabled={disabled}
                    onChange={(e) => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n)) patch(def.id, { value: Math.min(def.param!.max, Math.max(def.param!.min, n)) });
                    }}
                    className="h-8 w-20 rounded-lg px-2 text-xs"
                    aria-label={def.param.label}
                  />
                  {def.param.unit}
                </span>
              )}
            </label>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled && !lock}
          aria-label={def.label}
          disabled={disabled}
          onClick={() => patch(def.id, { enabled: !enabled })}
          className={cn(
            "relative h-6 w-11 shrink-0 self-start rounded-full transition-colors disabled:opacity-50",
            enabled && !lock ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              enabled && !lock && "translate-x-5"
            )}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Los avisos aparecen en la campana, en el menú lateral y arriba de cada módulo. Un aviso apagado no se calcula ni se cuenta.
      </p>
      {!canConfigure && (
        <PlanLockNote plan="esencial" cta="Ver el Plan Esencial">
          Prendé y apagá cada aviso y elegí desde qué margen o cuántos días te avisamos. Hoy tenés los avisos básicos con valores estándar.
        </PlanLockNote>
      )}

      {MODULES.map((m) => (
        <section key={m}>
          <h3 className="text-sm font-semibold text-foreground">{MODULE_LABEL[m]}</h3>
          {MODULE_NOTE[m] && <p className="mt-0.5 text-xs text-muted-foreground">{MODULE_NOTE[m]}</p>}
          <div className="divide-y divide-border">
            {ALERT_DEFS.filter((d) => d.module === m).map((d) => (
              <Row key={d.id} def={d} />
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-1.5 rounded-xl bg-muted/50 px-4 py-3">
        {FIXED_MODULES.map((f) => (
          <p key={f.module} className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{f.label}: </span>
            {f.description}
          </p>
        ))}
      </section>

      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      {canConfigure && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={!dirty || pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar avisos
          </Button>
          {done && !dirty && (
            <span className="inline-flex items-center gap-1 text-sm text-success">
              <Check className="h-4 w-4" />
              Guardado
            </span>
          )}
        </div>
      )}
    </div>
  );
}
