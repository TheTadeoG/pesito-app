import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { invoiceLabels } from "@/lib/invoice-labels";
import type { SaleDetail } from "@/lib/actions/sales";

export function SaleDetailDialog({
  open,
  onClose,
  loading,
  sale,
  paymentLabels,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  sale: SaleDetail | null;
  paymentLabels: Record<string, string>;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalle de la venta"
      description={sale ? formatDateTime(sale.created_at) : undefined}
    >
      {loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      )}

      {!loading && !sale && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No pudimos cargar el detalle de esta venta.
        </p>
      )}

      {!loading && sale && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{paymentLabels[sale.payment_method] ?? sale.payment_method}</Badge>
            {sale.invoice_type && sale.invoice_type !== "consumidor_final" && (
              <Badge tone="accent">{invoiceLabels[sale.invoice_type] ?? sale.invoice_type}</Badge>
            )}
            {sale.status === "anulada" && <Badge tone="danger">Anulada</Badge>}
          </div>

          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{sale.customerName}</span>
          </p>

          {sale.payment_method === "mixto" && sale.payments.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-border p-3">
              <p className="text-xs font-medium text-foreground">Cómo pagó</p>
              {sale.payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span
                    className={
                      p.method === "fiado" ? "font-medium text-danger" : "text-muted-foreground"
                    }
                  >
                    {paymentLabels[p.method] ?? p.method}
                    {p.method === "fiado" && " (a la cuenta del cliente)"}
                  </span>
                  <span
                    className={
                      p.method === "fiado" ? "font-semibold text-danger" : "font-medium text-foreground"
                    }
                  >
                    {formatCurrency(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-border rounded-xl border border-border">
            {sale.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate text-foreground">
                  {item.product_name}
                  {item.quantity > 1 && (
                    <span className="text-muted-foreground"> x{item.quantity}</span>
                  )}
                  <span className="text-muted-foreground"> · {formatCurrency(item.unit_price)}</span>
                </span>
                <span className="shrink-0 font-medium text-foreground">
                  {formatCurrency(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Descuento</span>
                <span className="text-danger">-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            {sale.surcharge > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recargo</span>
                <span className="text-warning">+{formatCurrency(sale.surcharge)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
