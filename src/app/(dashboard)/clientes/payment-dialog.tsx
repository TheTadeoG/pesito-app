"use client";

import { useState } from "react";
import { Banknote, CreditCard, Landmark, QrCode } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { registerPayment } from "@/app/(dashboard)/clientes/actions";
import { useToast } from "@/components/toast/toast-provider";
import { suggestBilletes } from "@/lib/billetes";
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
  const { showSuccess } = useToast();
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount) || 0;
  const receivedNum = Number(received) || 0;
  const vuelto = method === "efectivo" && received !== "" ? receivedNum - amountNum : 0;

  function resetForm() {
    setAmount("");
    setReceived("");
    setMethod("efectivo");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setPending(true);
    setError(null);
    const result = await registerPayment(customer.id, amountNum, method);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    showSuccess("¡Pago registrado!", `${customer.name} · ${formatCurrency(amountNum)}`);
    resetForm();
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
                onClick={() => {
                  setMethod(m.value);
                  if (m.value !== "efectivo") setReceived("");
                }}
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
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Monto a saldar{" "}
              <span className="font-normal text-muted-foreground">(Enter confirma)</span>
            </label>
            {customer && customer.balance > 0 && amount !== String(customer.balance) && (
              <button
                type="button"
                onClick={() => setAmount(String(customer.balance))}
                className="text-xs font-medium text-primary hover:underline"
              >
                Pagar deuda completa
              </button>
            )}
          </div>
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

        {method === "efectivo" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              ¿Con cuánto te paga?{" "}
              <span className="font-normal text-muted-foreground">(opcional, para el vuelto)</span>
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder={amount || "0.00"}
            />
            {received !== "" && (
              <div className="mt-2">
                {vuelto > 0 ? (
                  <div className="space-y-2 rounded-xl bg-success-bg px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-success">Vuelto</span>
                      <span className="text-lg font-bold text-success">
                        {formatCurrency(vuelto)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 border-t border-success/20 pt-2">
                      {suggestBilletes(vuelto).map((b) => (
                        <span
                          key={b.value}
                          className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-success"
                        >
                          {b.count} x {formatCurrency(b.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : vuelto < 0 ? (
                  <div className="flex items-center justify-between rounded-xl bg-danger-bg px-4 py-3">
                    <span className="text-sm font-medium text-danger">Falta</span>
                    <span className="text-lg font-bold text-danger">
                      {formatCurrency(-vuelto)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
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
