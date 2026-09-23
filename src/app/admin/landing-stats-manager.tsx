"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLandingStatsOffsets } from "@/app/admin/actions";

export interface LandingStatsOffsets {
  kioscosOffset: number;
  ventasOffset: number;
  montoOffset: number;
}

export function LandingStatsManager({ initial }: { initial: LandingStatsOffsets }) {
  const [kioscos, setKioscos] = useState(String(initial.kioscosOffset));
  const [ventas, setVentas] = useState(String(initial.ventasOffset));
  const [monto, setMonto] = useState(String(initial.montoOffset));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await updateLandingStatsOffsets({
      kioscosOffset: Number(kioscos) || 0,
      ventasOffset: Number(ventas) || 0,
      montoOffset: Number(monto) || 0,
    });
    setPending(false);
    setMessage(result.error ? { text: result.error, error: true } : { text: "Guardado." });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Se suman a lo que el sistema ya cuenta solo (organizaciones dadas de alta y ventas
        completadas), para poder incluir números reales que todavía no están en el sistema.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="ls-kioscos">Kioscos de más</Label>
          <Input
            id="ls-kioscos"
            type="number"
            min={0}
            value={kioscos}
            onChange={(e) => setKioscos(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ls-ventas">Ventas de más</Label>
          <Input
            id="ls-ventas"
            type="number"
            min={0}
            value={ventas}
            onChange={(e) => setVentas(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ls-monto">$ de más</Label>
          <Input
            id="ls-monto"
            type="number"
            min={0}
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {message && (
          <span className={`text-sm ${message.error ? "text-danger" : "text-success"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
