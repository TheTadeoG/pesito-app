"use client";

import { useState } from "react";
import { Banknote, Check, CircleDollarSign, CreditCard, Landmark, QrCode } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { applyPayment, overdueAmount, type DebtItem } from "@/lib/supplier-debt";
import { registerSupplierPayment } from "@/app/(dashboard)/proveedores/actions";
import { shortDate } from "@/app/(dashboard)/proveedores/debt-format";
import { useToast } from "@/components/toast/toast-provider";
import type { Supplier } from "@/lib/types";

type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "qr" | (string & {});

function methodsWithCustom(customMethods: string[]) {
  return [
    { value: "efectivo", label: "Efectivo", icon: Banknote },
    { value: "tarjeta", label: "Tarjeta", icon: CreditCard },
    { value: "transferencia", label: "Transferencia", icon: Landmark },
    { value: "qr", label: "QR", icon: QrCode },
    ...customMethods.map((name) => ({ value: name, label: name, icon: CircleDollarSign })),
  ];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function itemTitle(item: DebtItem): string {
  const base = item.purchaseId ? `Compra del ${shortDate(item.purchaseDay)}` : "Saldo sin compra asociada";
  if (!item.dueDate || item.daysToDue === null) return `${base} · sin fecha de vencimiento`;
  if (item.daysToDue < 0) {
    const n = -item.daysToDue;
    return `${base} · vencida hace ${n} ${n === 1 ? "día" : "días"}`;
  }
  if (item.daysToDue === 0) return `${base} · vence hoy`;
  return `${base} · vence el ${shortDate(item.dueDate)}`;
}

export function SupplierPaymentDialog({
  supplier,
  items = [],
  onClose,
  customPaymentMethods = [],
}: {
  supplier: Supplier | null;
  /** Lo que se le debe, compra por compra (para mostrar cómo se aplica el pago). */
  items?: DebtItem[];
  onClose: () => void;
  customPaymentMethods?: string[];
}) {
  const { showSuccess } = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const methods = methodsWithCustom(customPaymentMethods);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount) || 0;
  const balance = supplier ? round2(supplier.balance) : 0;
  const overdue = overdueAmount(items);
  const showOverdueChip = overdue > 0 && overdue < balance;
  const split = amountNum > 0 ? applyPayment(items, Math.min(amountNum, balance)) : [];
  const afterPayment = round2(balance - amountNum);

  function resetForm() {
    setAmount("");
    setMethod("efectivo");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    setPending(true);
    setError(null);
    const result = await registerSupplierPayment(supplier.id, amountNum, method);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    showSuccess("¡Pago registrado!", `${supplier.name} · ${formatCurrency(amountNum)}`);
    resetForm();
    onClose();
  }

  const quick: { key: string; label: string; value: number }[] = [
    { key: "all", label: `Todo · ${formatCurrency(balance)}`, value: balance },
    ...(showOverdueChip
      ? [{ key: "overdue", label: `Lo vencido · ${formatCurrency(overdue)}`, value: overdue }]
      : []),
  ];
  const quickMatch = quick.find((q) => Math.abs(q.value - amountNum) < 0.005)?.key ?? null;

  return (
    <Dialog
      open={Boolean(supplier)}
      onClose={onClose}
      title={supplier ? `Registrar pago a ${supplier.name}` : "Registrar pago"}
      description={supplier ? `Hoy le debés ${formatCurrency(balance)}` : ""}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">¿Cuánto le pagás?</label>
          <div className="flex flex-wrap gap-2">
            {balance > 0 &&
              quick.map((q) => (
                <button
                  key={q.key}
                  type="button"
                  aria-pressed={quickMatch === q.key}
                  onClick={() => setAmount(String(q.value))}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                    quickMatch === q.key
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-foreground hover:bg-muted"
                  )}
                >
                  {q.label}
                </button>
              ))}
            <span
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold",
                amountNum > 0 && !quickMatch
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              Otro monto
            </span>
          </div>
          <Input
            type="number"
            min={0}
            step="0.01"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Escribí el monto"
            aria-label="Monto a pagar"
            className="mt-2 h-11 text-base font-semibold"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">¿Cómo le pagás?</label>
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
            Este pago se descuenta de tu caja abierta con el medio elegido.
          </p>
        </div>

        {split.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <p className="bg-muted px-3.5 py-2 text-xs font-semibold text-muted-foreground">
              Cómo se aplica el pago
            </p>
            <div className="divide-y divide-border">
              {split.map(({ item, paid, remaining }, idx) => (
                <div key={item.purchaseId ?? `adj-${idx}`} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                    {remaining === 0 ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <i className="block h-2.5 w-2.5 rounded-full border-2 border-warning" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{itemTitle(item)}</p>
                    <p className="text-xs text-muted-foreground">
                      {remaining === 0
                        ? `${formatCurrency(item.amount)} → queda pagada`
                        : `${formatCurrency(item.amount)} → te quedan ${formatCurrency(remaining)}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-success">{`−${formatCurrency(paid)}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {amountNum > 0 && (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm",
              afterPayment <= 0 ? "bg-success-bg text-success" : "bg-warning-bg text-warning"
            )}
          >
            <span className="font-medium">Después de este pago</span>
            <span className="font-semibold">
              {afterPayment <= 0
                ? afterPayment < 0
                  ? `Queda ${formatCurrency(-afterPayment)} a tu favor`
                  : "Queda al día"
                : `Le debés ${formatCurrency(afterPayment)}`}
            </span>
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
          <Button type="submit" disabled={pending || amountNum <= 0}>
            {pending
              ? "Guardando…"
              : amountNum > 0
                ? `Confirmar pago de ${formatCurrency(amountNum)}`
                : "Registrar pago"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
