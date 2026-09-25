"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/toast/toast-provider";
import {
  getProductHistory,
  revertProductField,
  type ProductHistoryRow,
} from "@/app/(dashboard)/productos/actions";
import type { Product } from "@/lib/types";

type HistoryField = "price" | "cost";

function HistoryList({
  product,
  field,
  onClose,
}: {
  product: Product;
  field: HistoryField;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [rows, setRows] = useState<ProductHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const label = field === "price" ? "precio" : "costo";

  useEffect(() => {
    getProductHistory(product.id, field)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [product.id, field]);

  async function handleRevert(row: ProductHistoryRow) {
    if (!confirm(`¿Volver el ${label} de "${product.name}" a ${formatCurrency(row.newValue)}?`))
      return;
    setRevertingId(row.id);
    const result = await revertProductField(product.id, field, row.newValue);
    setRevertingId(null);
    if (result.error) return;
    showSuccess(field === "price" ? "Precio actualizado" : "Costo actualizado", formatCurrency(row.newValue));
    router.refresh();
    onClose();
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Todavía no hay cambios de {label} registrados para este producto.
      </p>
    );
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {rows.map((row, i) => (
        <div
          key={row.id}
          className="flex flex-col gap-2 rounded-xl border border-border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          <div className="min-w-0 flex-1">
            <p className="whitespace-nowrap text-sm text-foreground">
              <span className="text-muted-foreground line-through">
                {formatCurrency(row.oldValue)}
              </span>{" "}
              → <span className="font-semibold">{formatCurrency(row.newValue)}</span>
            </p>
            {row.bulk && (
              <p className="mt-1 w-fit max-w-full truncate rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                Aumento masivo · {row.bulk.amountLabel} · {row.bulk.groupLabel}
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(row.changedAt)}</p>
            {row.changedByLabel && (
              <p className="truncate text-xs text-muted-foreground" title={row.changedByLabel}>
                {row.changedByLabel}
              </p>
            )}
          </div>
          {i !== 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRevert(row)}
              disabled={revertingId === row.id}
              title={`Volver a ${formatCurrency(row.newValue)}`}
              className="shrink-0 self-start whitespace-nowrap sm:self-auto"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Volver a este {label}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function PriceHistoryContent({ product, onClose }: { product: Product; onClose: () => void }) {
  const [field, setField] = useState<HistoryField>("price");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {(["price", "cost"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setField(f)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
              field === f
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "price" ? "Precio de venta" : "Costo"}
          </button>
        ))}
      </div>
      {/* key: cada pestaña carga su propio historial */}
      <HistoryList key={field} product={product} field={field} onClose={onClose} />
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
      title="Historial de precios y costos"
      description={product ? product.name : ""}
    >
      {product && <PriceHistoryContent key={product.id} product={product} onClose={onClose} />}
    </Dialog>
  );
}
