"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { registerPayment } from "@/app/(dashboard)/clientes/actions";
import type { Customer } from "@/lib/types";

export function PaymentDialog({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setPending(true);
    setError(null);
    const result = await registerPayment(customer.id, Number(amount) || 0);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAmount("");
    onClose();
  }

  return (
    <Dialog
      open={Boolean(customer)}
      onClose={onClose}
      title="Registrar pago"
      description={
        customer ? `${customer.name} · debe ${formatCurrency(customer.balance)}` : ""
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Monto que paga
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !amount}>
            {pending ? "Guardando…" : "Registrar pago"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
