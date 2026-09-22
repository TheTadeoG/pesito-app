"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { adjustStock } from "@/app/(dashboard)/inventario/actions";
import type { Product } from "@/lib/types";

type Mode = "sumar" | "restar" | "ajustar";

const modes: { value: Mode; label: string }[] = [
  { value: "sumar", label: "Sumar" },
  { value: "restar", label: "Restar" },
  { value: "ajustar", label: "Ajustar a" },
];

export function AdjustDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("sumar");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("sumar");
    setAmount("");
    setReason("");
    setError(null);
  }

  function closeAndReset() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!product) return;
    const value = Number(amount);
    if (!amount || Number.isNaN(value)) {
      setError("Ingresá una cantidad válida.");
      return;
    }

    const delta =
      mode === "sumar"
        ? Math.abs(value)
        : mode === "restar"
          ? -Math.abs(value)
          : value - Number(product.stock);

    if (delta === 0) {
      setError(
        mode === "ajustar" ? "Ese ya es el stock actual." : "Ingresá una cantidad distinta de cero."
      );
      return;
    }

    setPending(true);
    setError(null);
    const result = await adjustStock(product.id, delta, reason);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeAndReset();
  }

  return (
    <Dialog
      open={Boolean(product)}
      onClose={closeAndReset}
      title="Ajustar stock"
      description={product ? `${product.name} · stock actual: ${product.stock}${product.unit}` : ""}
    >
      <div className="space-y-4">
        <div className="inline-flex w-full rounded-xl border border-border bg-muted/50 p-1">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
                mode === m.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div>
          <Label htmlFor="adjust-amount">
            {mode === "ajustar" ? "Nueva cantidad en stock" : "Cantidad"}
          </Label>
          <Input
            id="adjust-amount"
            type="number"
            step="0.01"
            min={mode === "ajustar" ? 0 : undefined}
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === "ajustar" ? "Ej: 50" : "Ej: 10"}
          />
        </div>
        <div>
          <Label htmlFor="adjust-reason">Motivo (opcional)</Label>
          <Input
            id="adjust-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rotura, conteo físico, etc."
          />
        </div>

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeAndReset}>
            Cancelar
          </Button>
          <Button type="button" disabled={pending || !amount} onClick={handleSubmit}>
            {pending ? "Guardando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
