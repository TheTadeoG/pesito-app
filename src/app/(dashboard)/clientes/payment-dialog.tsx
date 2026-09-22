"use client";

import { useState } from "react";
import { Banknote, CreditCard, Landmark, QrCode } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { registerPayment } from "@/app/(dashboard)/clientes/actions";
import type { Customer } from "@/lib/types";

type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "qr";

const methods: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "efectivo", label: "Efectivo", icon: Banknote },
  { value: "tarjeta", label: "Tarjeta", icon: CreditCard },
  { value: "transferencia", label: "Transferencia", icon: Landmark },
  { value: "qr", label: "QR", icon: QrCode },
];

export function PaymentDialog({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setPending(true);
    setError(null);
    const result = await registerPayment(customer.id, Number(amount) || 0, method);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAmount("");
    setMethod("efectivo");
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
            Medio de pago
          </label>
          <div className="grid grid-cols-4 gap-2">
            {methods.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
                  method === m.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-foreground hover:bg-muted"
                )}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Este cobro se suma a tu caja abierta con el medio elegido.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Monto que paga <span className="font-normal text-muted-foreground">(Enter confirma)</span>
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
            {pending ? "Guardando…" : "Registrar pago (Enter)"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
