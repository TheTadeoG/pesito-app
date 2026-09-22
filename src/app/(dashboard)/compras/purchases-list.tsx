"use client";

import { useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getPurchaseDetail, type PurchaseDetail } from "@/app/(dashboard)/compras/actions";
import { PurchaseDetailDialog } from "@/app/(dashboard)/compras/purchase-detail-dialog";

export interface PurchaseRow {
  id: string;
  created_at: string;
  total: number;
  supplierName: string;
  itemsSummary: string;
  notes: string | null;
}

export function PurchasesList({ purchases }: { purchases: PurchaseRow[] }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<PurchaseDetail | null>(null);

  async function openDetail(purchaseId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailPurchase(null);
    const result = await getPurchaseDetail(purchaseId);
    setDetailLoading(false);
    setDetailPurchase(result.purchase ?? null);
  }

  if (purchases.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        Todavía no registraste ninguna compra.
      </p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border">
        {purchases.map((purchase) => (
          <div
            key={purchase.id}
            role="button"
            tabIndex={0}
            onClick={() => openDetail(purchase.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetail(purchase.id);
              }
            }}
            className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{purchase.supplierName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {formatDateTime(purchase.created_at)} · {purchase.itemsSummary}
              </p>
              {purchase.notes && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{purchase.notes}</p>
              )}
            </div>
            <span className="font-semibold text-foreground">{formatCurrency(purchase.total)}</span>
          </div>
        ))}
      </div>

      <PurchaseDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        purchase={detailPurchase}
      />
    </div>
  );
}
