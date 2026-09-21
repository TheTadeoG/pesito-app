"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { AdjustDialog } from "@/app/(dashboard)/inventario/adjust-dialog";

interface MovementRow {
  id: string;
  type: string;
  quantity: number;
  reference: string | null;
  created_at: string;
  product_name: string;
}

export function InventarioClient({
  products,
  movements,
}: {
  products: Product[];
  movements: MovementRow[];
}) {
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const lowStock = products.filter((p) => p.stock <= p.min_stock);

  return (
    <div className="space-y-6">
      {lowStock.length > 0 && (
        <Card className="border-danger/30 bg-danger-bg/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
            <p className="text-sm font-medium text-danger">
              {lowStock.length} producto{lowStock.length > 1 ? "s" : ""} por debajo del stock
              mínimo
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock por producto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              Cargá productos para empezar a controlar tu inventario.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Costo: {product.cost ? formatCurrency(product.cost) : "—"} · Mínimo:{" "}
                      {product.min_stock}{product.unit}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge tone={product.stock <= product.min_stock ? "danger" : "default"}>
                      {product.stock}{product.unit}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjusting(product)}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Ajustar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos recientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Todavía no hay movimientos de stock.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(m.created_at)}
                      {m.reference ? ` · ${m.reference}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{m.type}</Badge>
                    <span
                      className={`text-sm font-semibold ${m.quantity < 0 ? "text-danger" : "text-success"}`}
                    >
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}
