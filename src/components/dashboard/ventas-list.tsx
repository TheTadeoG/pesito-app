"use client";

import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getSaleDetail, type SaleDetail } from "@/lib/actions/sales";
import { invoiceLabels } from "@/lib/invoice-labels";
import { SaleDetailDialog } from "@/components/dashboard/sale-detail-dialog";
import { VoidSaleDialog } from "@/components/dashboard/void-sale-dialog";

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
  const [voidTarget, setVoidTarget] = useState<{ id: string; total: number } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSale, setDetailSale] = useState<SaleDetail | null>(null);
  const pager = usePagination(sales.length, String(sales.length), "pesito-ventas-page-size");

  async function openDetail(saleId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailSale(null);
    const result = await getSaleDetail(saleId);
    setDetailLoading(false);
    setDetailSale(result.sale ?? null);
  }

  function handleVoid(sale: SaleRow) {
    setVoidTarget({ id: sale.id, total: sale.total });
  }

  if (sales.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border">
        {sales.slice(pager.start, pager.end).map((sale) => (
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 break-words text-sm font-medium text-foreground">{sale.customerName}</span>
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
            <span className="shrink-0 whitespace-nowrap font-semibold text-foreground">{formatCurrency(sale.total)}</span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail(sale.id);
                }}
                aria-label="Ver detalle"
                title="Ver detalle"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoid(sale);
                }}
                aria-label="Anular venta"
                title="Anular venta"
              >
                <Ban className="h-4 w-4 text-danger" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <PaginationBar
        total={sales.length}
        page={pager.page}
        pageSize={pager.pageSize}
        noun="ventas"
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
      />

      <VoidSaleDialog
        sale={voidTarget}
        onClose={() => setVoidTarget(null)}
        onVoided={() => {
          setVoidTarget(null);
          router.refresh();
        }}
      />

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
