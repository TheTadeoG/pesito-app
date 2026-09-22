import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Proveedor:{" "}
              <span className="font-medium text-foreground">{purchase.supplierName}</span>
            </p>
            {purchase.status === "anulada" && <Badge tone="danger">Anulada</Badge>}
          </div>

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

          {purchase.payments.length > 0 ? (
            <div className="space-y-1.5 rounded-xl border border-border p-3">
              <p className="text-xs font-medium text-foreground">Cómo se pagó</p>
              {purchase.payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span
                    className={
                      p.method === "cuenta_corriente"
                        ? "font-medium text-warning"
                        : "text-muted-foreground"
                    }
                  >
                    {p.method === "cuenta_corriente"
                      ? "A cuenta corriente"
                      : paymentLabels[p.method] ?? p.method}
                  </span>
                  <span
                    className={
                      p.method === "cuenta_corriente"
                        ? "font-semibold text-warning"
                        : "font-medium text-foreground"
                    }
                  >
                    {formatCurrency(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 rounded-xl border border-border p-3">
              {purchase.total - purchase.accountAmount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    Pagado
                    {purchase.paymentMethod &&
                      ` con ${paymentLabels[purchase.paymentMethod] ?? purchase.paymentMethod}`}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(purchase.total - purchase.accountAmount)}
                  </span>
                </div>
              )}
              {purchase.accountAmount > 0 && (
                <div className="flex justify-between text-sm text-warning">
                  <span>A cuenta corriente</span>
                  <span className="font-medium">{formatCurrency(purchase.accountAmount)}</span>
                </div>
              )}
            </div>
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
