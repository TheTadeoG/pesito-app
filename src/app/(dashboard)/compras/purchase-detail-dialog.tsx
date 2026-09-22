import { Dialog } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { PurchaseDetail } from "@/app/(dashboard)/compras/actions";

export function PurchaseDetailDialog({
  open,
  onClose,
  loading,
  purchase,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  purchase: PurchaseDetail | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalle de la compra"
      description={purchase ? formatDateTime(purchase.created_at) : undefined}
    >
      {loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      )}

      {!loading && !purchase && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No pudimos cargar el detalle de esta compra.
        </p>
      )}

      {!loading && purchase && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Proveedor:{" "}
            <span className="font-medium text-foreground">{purchase.supplierName}</span>
          </p>

          <div className="divide-y divide-border rounded-xl border border-border">
            {purchase.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate text-foreground">
                  {item.product_name}
                  {item.quantity > 1 && (
                    <span className="text-muted-foreground"> x{item.quantity}</span>
                  )}
                  <span className="text-muted-foreground"> · {formatCurrency(item.unit_cost)}</span>
                </span>
                <span className="shrink-0 font-medium text-foreground">
                  {formatCurrency(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {purchase.notes && (
            <p className="text-sm text-muted-foreground">Notas: {purchase.notes}</p>
          )}

          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCurrency(purchase.total)}</span>
          </div>
        </div>
      )}
    </Dialog>
  );
}
