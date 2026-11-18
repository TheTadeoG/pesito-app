"use client";

import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Eye } from "lucide-react";
import { RowActions } from "@/components/dashboard/row-actions";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getSaleDetail, type SaleDetail } from "@/lib/actions/sales";
import { SaleDetailDialog } from "@/components/dashboard/sale-detail-dialog";
import { VoidSaleDialog } from "@/components/dashboard/void-sale-dialog";

export interface SaleRow {
  id: string;
  created_at: string;
  total: number;
  payment_method: string;
  invoice_type: string;
  /** Factura electrónica autorizada de la venta («Factura C»), si la tiene. */
  voucher?: string | null;
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
  const [voidTarget, setVoidTarget] = useState<{ id: string; total: number; creditNote?: boolean } | null>(null);
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
    // Con factura electrónica se anula emitiendo la nota de crédito.
    setVoidTarget({ id: sale.id, total: sale.total, creditNote: Boolean(sale.voucher) });
  }

  if (sales.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-y border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pl-5 pr-3">Fecha</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Medio de pago</th>
              <th className="px-3 py-2.5">Productos</th>
              <th className="px-3 py-2.5 text-right">Total</th>
              <th className="py-2.5 pl-3 pr-5 text-right">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.slice(pager.start, pager.end).map((sale) => (
              <tr
                key={sale.id}
                tabIndex={0}
                onClick={() => openDetail(sale.id)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                    e.preventDefault();
                    openDetail(sale.id);
                  }
                }}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted"
              >
                <td className="whitespace-nowrap py-2.5 pl-5 pr-3 text-muted-foreground">{formatDateTime(sale.created_at)}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{sale.customerName}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge>{paymentLabels[sale.payment_method] ?? sale.payment_method}</Badge>
                    {sale.payment_method === "mixto" && !!sale.fiadoAmount && sale.fiadoAmount > 0 && (
                      <Badge tone="danger">Fiado {formatCurrency(sale.fiadoAmount)}</Badge>
                    )}
                    {sale.voucher && <Badge tone="accent">{sale.voucher}</Badge>}
                  </div>
                </td>
                <td className="max-w-[16rem] truncate px-3 py-2.5 text-muted-foreground">{sale.itemsSummary}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">{formatCurrency(sale.total)}</td>
                <td className="py-2.5 pl-3 pr-5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end">
                    <RowActions
                      primary={{ label: "Ver detalle", icon: Eye, onClick: () => void openDetail(sale.id) }}
                      items={[
                        {
                          label: sale.voucher ? "Anular con nota de crédito" : "Anular venta",
                          icon: Ban,
                          danger: true,
                          onClick: () => handleVoid(sale),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        creditNote={voidTarget?.creditNote}
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
