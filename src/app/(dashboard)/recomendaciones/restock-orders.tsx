"use client";

import { useState, useTransition } from "react";
import { Check, PackageCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { closeRestockOrder, createRestockOrder } from "@/app/(dashboard)/recomendaciones/actions";

/** "Ya lo pedí": guarda el pedido para que no se vuelva a sugerir lo que viene en camino. */
export function OrderPlacedButton({
  supplierId,
  items,
}: {
  supplierId: string;
  items: { productId: string; name: string; quantity: number }[];
}) {
  const { showSuccess, showWarning } = useToast();
  const [pending, startTransition] = useTransition();

  function place() {
    if (
      !confirm(
        `¿Ya hiciste este pedido (${items.length} producto${items.length === 1 ? "" : "s"})? Lo vamos a marcar en camino y no te lo vamos a volver a sugerir hasta que llegue.`
      )
    )
      return;
    startTransition(async () => {
      const result = await createRestockOrder({ supplierId, items });
      if (result.error) {
        showWarning(result.error);
        return;
      }
      showSuccess("Pedido en camino", "Se cierra solo cuando cargues la compra de este proveedor.");
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={place} disabled={pending}>
      <PackageCheck className="h-4 w-4" />
      {pending ? "Guardando…" : "Ya lo pedí"}
    </Button>
  );
}

export interface PendingOrderView {
  id: string;
  supplierName: string;
  createdLabel: string;
  expectedLabel: string | null;
  overdue: boolean;
  items: { name: string; remaining: string }[];
}

/** Un pedido en camino, con las opciones de cerrarlo a mano. */
export function PendingOrderCard({ order }: { order: PendingOrderView }) {
  const { showSuccess, showWarning } = useToast();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  function close(status: "recibido" | "cancelado") {
    const ask =
      status === "recibido"
        ? "¿Marcar este pedido como recibido completo?"
        : "¿Cancelar este pedido? Los productos vuelven a sugerirse.";
    if (!confirm(ask)) return;
    startTransition(async () => {
      const result = await closeRestockOrder(order.id, status);
      if (result.error) {
        showWarning(result.error);
        return;
      }
      showSuccess(status === "recibido" ? "Pedido recibido" : "Pedido cancelado");
    });
  }

  const shown = expanded ? order.items : order.items.slice(0, 3);

  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{order.supplierName}</p>
          <p className="text-xs text-muted-foreground">
            {`Pedido el ${order.createdLabel}`}
            {order.expectedLabel && ` · llega el ${order.expectedLabel}`}
          </p>
          {order.overdue && (
            <p className="text-xs font-medium text-danger">Ya pasó la fecha estimada: fijate si llegó.</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => close("recibido")} disabled={pending}>
            <Check className="h-3.5 w-3.5" />
            Llegó
          </Button>
          <Button variant="ghost" size="sm" onClick={() => close("cancelado")} disabled={pending}>
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {shown.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
            <span className="truncate">{item.name}</span>
            <span className="shrink-0">{item.remaining}</span>
          </li>
        ))}
      </ul>
      {order.items.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Ver menos" : `Ver los ${order.items.length} productos`}
        </button>
      )}
    </div>
  );
}
