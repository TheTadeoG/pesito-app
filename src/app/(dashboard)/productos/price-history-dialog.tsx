"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/toast/toast-provider";
import {
  getProductPriceHistory,
  revertProductPrice,
  type PriceHistoryRow,
} from "@/app/(dashboard)/productos/actions";
import type { Product } from "@/lib/types";

function PriceHistoryContent({ product, onClose }: { product: Product; onClose: () => void }) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [rows, setRows] = useState<PriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  useEffect(() => {
    getProductPriceHistory(product.id)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [product.id]);

  async function handleRevert(row: PriceHistoryRow) {
    if (
      !confirm(`¿Volver el precio de "${product.name}" a ${formatCurrency(row.newPrice)}?`)
    )
      return;
    setRevertingId(row.id);
    const result = await revertProductPrice(product.id, row.newPrice);
    setRevertingId(null);
    if (result.error) return;
    showSuccess("Precio actualizado", formatCurrency(row.newPrice));
    router.refresh();
    onClose();
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Todavía no hay cambios de precio registrados para este producto.
      </p>
    );
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {rows.map((row, i) => (
        <div
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm text-foreground">
              <span className="text-muted-foreground line-through">
                {formatCurrency(row.oldPrice)}
              </span>{" "}
              → <span className="font-semibold">{formatCurrency(row.newPrice)}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(row.changedAt)}
              {row.changedByLabel && ` · ${row.changedByLabel}`}
            </p>
          </div>
          {i !== 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRevert(row)}
              disabled={revertingId === row.id}
              title={`Volver a ${formatCurrency(row.newPrice)}`}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Volver a este precio
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function PriceHistoryDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(product)}
      onClose={onClose}
      title="Historial de precios"
      description={product ? product.name : ""}
    >
      {product && <PriceHistoryContent key={product.id} product={product} onClose={onClose} />}
    </Dialog>
  );
}
