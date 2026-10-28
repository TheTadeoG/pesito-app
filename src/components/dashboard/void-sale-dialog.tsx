"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast/toast-provider";
import { voidSale } from "@/lib/actions/sales";
import { formatCurrency } from "@/lib/utils";

/**
 * Anular una venta con motivo. La venta no se borra: queda como «Anulada» con quién, cuándo y por qué. Con
 * factura electrónica la base se niega (hace falta una nota de crédito).
 */
export function VoidSaleDialog({
  sale,
  onClose,
  onVoided,
}: {
  sale: { id: string; total: number } | null;
  onClose: () => void;
  onVoided: () => void;
}) {
  if (!sale) return null;
  return <VoidForm sale={sale} onClose={onClose} onVoided={onVoided} />;
}

function VoidForm({ sale, onClose, onVoided }: { sale: { id: string; total: number }; onClose: () => void; onVoided: () => void }) {
  const { showSuccess } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ok = reason.trim().length >= 3;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await voidSale(sale.id, reason);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("Venta anulada", "Se repuso el stock y quedó registrado el motivo.");
      onVoided();
    });
  }

  return (
    <Dialog open onClose={onClose} title="Anular venta" description={`Venta de ${formatCurrency(sale.total)}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          Se repone el stock vendido y se ajustan la caja y la cuenta del cliente. La venta <b>no se borra</b>: queda en el
          historial como «Anulada», con quién la anuló, cuándo y por qué. No se puede deshacer.
        </p>
        <div>
          <Label htmlFor="void-reason" required>
            Motivo
          </Label>
          <textarea
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            autoFocus
            placeholder="Por ejemplo: el cliente devolvió el producto"
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={pending || !ok}>
            {pending ? "Anulando…" : "Anular venta"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
