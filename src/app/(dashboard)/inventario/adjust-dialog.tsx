"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustStock } from "@/app/(dashboard)/inventario/actions";
import type { Product } from "@/lib/types";

export function AdjustDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(delta: number) {
    if (!product) return;
    setPending(true);
    setError(null);
    const result = await adjustStock(product.id, delta, reason);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAmount("");
    setReason("");
    onClose();
  }

  return (
    <Dialog
      open={Boolean(product)}
      onClose={onClose}
      title="Ajustar stock"
      description={product ? `${product.name} · stock actual: ${product.stock}${product.unit}` : ""}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="adjust-amount">Cantidad</Label>
          <Input
            id="adjust-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ej: 10"
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
          <Button
            type="button"
            variant="outline"
            disabled={pending || !amount}
            onClick={() => handleSubmit(-Math.abs(Number(amount) || 0))}
          >
            Restar
          </Button>
          <Button
            type="button"
            disabled={pending || !amount}
            onClick={() => handleSubmit(Math.abs(Number(amount) || 0))}
          >
            Sumar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
