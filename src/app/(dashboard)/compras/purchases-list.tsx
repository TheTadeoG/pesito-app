"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  getPurchaseDetail,
  voidPurchase,
  type PurchaseDetail,
} from "@/app/(dashboard)/compras/actions";
import { PurchaseDetailDialog } from "@/app/(dashboard)/compras/purchase-detail-dialog";
import { useToast } from "@/components/toast/toast-provider";

export interface PurchaseRow {
  id: string;
  created_at: string;
  total: number;
  status: string;
  supplierName: string;
  itemsSummary: string;
  notes: string | null;
  accountAmount: number;
}

export function PurchasesList({ purchases }: { purchases: PurchaseRow[] }) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<PurchaseDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openDetail(purchaseId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailPurchase(null);
    const result = await getPurchaseDetail(purchaseId);
    setDetailLoading(false);
    setDetailPurchase(result.purchase ?? null);
  }

  async function handleVoid(purchase: PurchaseRow) {
    if (
      !confirm(
        `¿Anular la compra de ${formatCurrency(purchase.total)}? Se revierte el stock sumado y no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusyId(purchase.id);
    setError(null);
    const result = await voidPurchase(purchase.id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    showSuccess("Compra anulada", "Se revirtió el stock sumado.");
    router.refresh();
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
      {error && (
        <p className="mx-5 mt-3 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
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
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{purchase.supplierName}</p>
                {purchase.status === "anulada" && <Badge tone="danger">Anulada</Badge>}
                {purchase.status !== "anulada" && purchase.accountAmount > 0 && (
                  <Badge tone="warning">
                    Cuenta corriente {formatCurrency(purchase.accountAmount)}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {formatDateTime(purchase.created_at)} · {purchase.itemsSummary}
              </p>
              {purchase.notes && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{purchase.notes}</p>
              )}
            </div>
            <span className="font-semibold text-foreground">{formatCurrency(purchase.total)}</span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail(purchase.id);
                }}
                aria-label="Ver detalle"
                title="Ver detalle"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {purchase.status !== "anulada" && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVoid(purchase);
                  }}
                  disabled={busyId === purchase.id}
                  aria-label="Anular compra"
                  title="Anular compra"
                >
                  <Ban className="h-4 w-4 text-danger" />
                </Button>
              )}
            </div>
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
