import { Dialog } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
import { VentasList } from "@/components/dashboard/ventas-list";
import type { CajaDetail } from "@/app/(dashboard)/caja/actions";

export function CajaDetailDialog({
  open,
  onClose,
  loading,
  detail,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  detail: CajaDetail | null;
}) {
  const diff =
    detail && detail.closingAmount !== null ? detail.closingAmount - detail.expectedAmount : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalle de caja"
      description={detail ? `${detail.userLabel} · ${formatDateTime(detail.openedAt)}` : undefined}
      className="max-w-xl"
    >
      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>}

      {!loading && !detail && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No pudimos cargar el detalle de esta caja.
        </p>
      )}

      {!loading && detail && (
        <div className="space-y-4">
          <div className="space-y-1.5 rounded-xl border border-border p-3.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Apertura</span>
              <span className="text-foreground">{formatCurrency(detail.openingAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">+ Ventas en efectivo</span>
              <span className="text-success">{formatCurrency(detail.salesCashTotal)}</span>
            </div>
            {detail.debtPaymentsTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  + Clientes pagando su deuda (fiado) en efectivo
                </span>
                <span className="text-success">{formatCurrency(detail.debtPaymentsTotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">+ Ingresos</span>
              <span className="text-success">{formatCurrency(detail.ingresosTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">- Retiros</span>
              <span className="text-danger">-{formatCurrency(detail.retirosTotal)}</span>
            </div>
            {detail.cashPurchasesTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">- Compras pagadas en efectivo</span>
                <span className="text-danger">-{formatCurrency(detail.cashPurchasesTotal)}</span>
              </div>
            )}
            {detail.supplierPaymentsTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">- Pagos a proveedores en efectivo</span>
                <span className="text-danger">-{formatCurrency(detail.supplierPaymentsTotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-foreground">
              <span>= Efectivo esperado</span>
              <span>{formatCurrency(detail.expectedAmount)}</span>
            </div>
            {detail.closingAmount !== null && diff !== null && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Efectivo contado</span>
                  <span className="text-foreground">{formatCurrency(detail.closingAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                  <span className="text-foreground">Diferencia</span>
                  <span className={diff === 0 ? "text-success" : diff > 0 ? "text-success" : "text-danger"}>
                    {diff > 0 ? "+" : ""}
                    {formatCurrency(diff)}
                  </span>
                </div>
              </>
            )}
          </div>

          {detail.paymentBreakdown.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">
                Cobros por medio de pago
              </h3>
              <div className="space-y-1 rounded-xl border border-border p-3.5">
                {detail.paymentBreakdown.map((row) => (
                  <div key={row.method} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {paymentLabels[row.method] ?? row.method}
                      {row.method === "fiado" && " (pendiente de cobro)"}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(row.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.movements.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">
                Movimientos de efectivo
              </h3>
              <div className="divide-y divide-border rounded-xl border border-border">
                {detail.movements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground">
                        {m.type === "ingreso" ? "Ingreso" : "Retiro"}
                        {m.reason ? ` · ${m.reason}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(m.created_at)}
                      </p>
                    </div>
                    <span
                      className={
                        m.type === "ingreso"
                          ? "shrink-0 font-semibold text-success"
                          : "shrink-0 font-semibold text-danger"
                      }
                    >
                      {m.type === "ingreso" ? "+" : "-"}
                      {formatCurrency(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-foreground">Ventas de esta caja</h3>
            <div className="rounded-xl border border-border">
              <VentasList
                sales={detail.saleRows}
                paymentLabels={paymentLabels}
                emptyLabel="No hubo ventas en esta caja."
              />
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
