"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { voidSale, getSaleDetail, type SaleDetail } from "@/lib/actions/sales";
import { invoiceLabels } from "@/lib/invoice-labels";
import { SaleDetailDialog } from "@/components/dashboard/sale-detail-dialog";
import { useToast } from "@/components/toast/toast-provider";

export interface SaleRow {
  id: string;
  created_at: string;
  total: number;
  payment_method: string;
  invoice_type: string;
  customerName: string;
  itemsSummary: string;
  // Sólo se completa cuando la venta tiene una parte cargada a fiado (venta
  // 100% fiado, o "mixto" con un componente fiado). 0/undefined = no debe.
  fiadoAmount?: number;
}

export function VentasList({
  sales,
  paymentLabels,
  emptyLabel = "Todavía no registraste ventas.",
}: {
  sales: SaleRow[];
  paymentLabels: Record<string, string>;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSale, setDetailSale] = useState<SaleDetail | null>(null);

  async function openDetail(saleId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailSale(null);
    const result = await getSaleDetail(saleId);
    setDetailLoading(false);
    setDetailSale(result.sale ?? null);
  }

  async function handleVoid(sale: SaleRow) {
    if (
      !confirm(
        `¿Anular la venta de ${formatCurrency(sale.total)}? Se repone el stock vendido y no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusyId(sale.id);
    setError(null);
    const result = await voidSale(sale.id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    showSuccess("Venta anulada", "Se repuso el stock vendido.");
    router.refresh();
  }

  if (sales.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <div>
      {error && (
        <p className="mx-5 mt-3 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <div className="divide-y divide-border">
        {sales.map((sale) => (
          <div
            key={sale.id}
            role="button"
            tabIndex={0}
            onClick={() => openDetail(sale.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetail(sale.id);
              }
            }}
            className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{sale.customerName}</span>
                <Badge>{paymentLabels[sale.payment_method] ?? sale.payment_method}</Badge>
                {sale.payment_method === "mixto" && !!sale.fiadoAmount && sale.fiadoAmount > 0 && (
                  <Badge tone="danger">Fiado {formatCurrency(sale.fiadoAmount)}</Badge>
                )}
                {sale.invoice_type && sale.invoice_type !== "consumidor_final" && (
                  <Badge tone="accent">
                    {invoiceLabels[sale.invoice_type] ?? sale.invoice_type}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {formatDateTime(sale.created_at)} · {sale.itemsSummary}
              </p>
            </div>
            <span className="font-semibold text-foreground">{formatCurrency(sale.total)}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleVoid(sale);
              }}
              disabled={busyId === sale.id}
              aria-label="Anular venta"
            >
              <Ban className="h-4 w-4 text-danger" />
            </Button>
          </div>
        ))}
      </div>

      <SaleDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        sale={detailSale}
        paymentLabels={paymentLabels}
      />
    </div>
  );
}
