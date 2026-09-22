"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { voidSale } from "@/lib/actions/sales";
import { invoiceLabels } from "@/lib/invoice-labels";

export interface SaleRow {
  id: string;
  created_at: string;
  total: number;
  payment_method: string;
  invoice_type: string;
  customerName: string;
  itemsSummary: string;
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <div key={sale.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{sale.customerName}</span>
                <Badge>{paymentLabels[sale.payment_method] ?? sale.payment_method}</Badge>
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
              onClick={() => handleVoid(sale)}
              disabled={busyId === sale.id}
              aria-label="Anular venta"
            >
              <Ban className="h-4 w-4 text-danger" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
