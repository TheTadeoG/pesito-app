"use client";

import { useState, useTransition } from "react";
import { Check, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { formatCurrency } from "@/lib/utils";
import { applyPriceSuggestions } from "@/app/(dashboard)/recomendaciones/actions";

export interface PriceSuggestionItem {
  productId: string;
  name: string;
  brand: string | null;
  price: number;
  cost: number;
  suggestedPrice: number;
  currentMarkup: number;
  suggestedMarkup: number;
  reason: "costo-subio" | "perdida" | "margen-bajo";
  detail: string;
}

const reasonLabel: Record<PriceSuggestionItem["reason"], string> = {
  perdida: "Vendés a pérdida",
  "costo-subio": "El costo subió",
  "margen-bajo": "Margen bajo",
};

export function PriceSuggestions({
  items,
  canApply,
}: {
  items: PriceSuggestionItem[];
  canApply: boolean;
}) {
  const { showSuccess, showWarning } = useToast();
  const [rows, setRows] = useState(items);
  const [pending, startTransition] = useTransition();

  function apply(chosen: PriceSuggestionItem[]) {
    startTransition(async () => {
      const result = await applyPriceSuggestions(
        chosen.map((c) => ({ productId: c.productId, price: c.suggestedPrice }))
      );
      if (result.error) {
        showWarning(result.error);
        return;
      }
      const done = new Set(result.applied);
      setRows((current) => current.filter((r) => !done.has(r.productId)));
      if (result.failed > 0) showWarning(`No pudimos actualizar ${result.failed} precios.`);
      if (done.size > 0) {
        showSuccess(done.size === 1 ? "Precio actualizado" : `${done.size} precios actualizados`);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Check className="h-5 w-5 text-success" />
          Tus precios están al día: ningún producto pide cambios por costo o margen.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {rows.length === 1 ? "1 producto" : `${rows.length} productos`} con el precio para revisar.
          </p>
          {canApply && (
            <Button size="sm" disabled={pending} onClick={() => apply(rows)}>
              Aplicar todos
            </Button>
          )}
        </div>
        <div className="divide-y divide-border">
          {rows.slice(0, 100).map((r) => (
            <div key={r.productId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {`${reasonLabel[r.reason]}. ${r.detail}`}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground line-through">{formatCurrency(r.price)}</p>
                <p className="font-semibold text-foreground">{formatCurrency(r.suggestedPrice)}</p>
              </div>
              {canApply && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => apply([r])}>
                  <Tag className="mr-1 h-3.5 w-3.5" />
                  Aplicar
                </Button>
              )}
            </div>
          ))}
        </div>
        {rows.length > 100 && (
          <p className="text-xs text-muted-foreground">
            Mostramos los 100 más importantes. Al aplicarlos, aparecen los que siguen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
