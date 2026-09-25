"use client";

import { useState, type ComponentProps } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { paymentLabels } from "@/lib/payment-labels";
import { VentasList, type SaleRow } from "@/components/dashboard/ventas-list";
import { PosClient } from "@/app/(dashboard)/pos/pos-client";

type PosScreenProps = Omit<ComponentProps<typeof PosClient>, "onSaleCompleted"> & {
  recentSales: SaleRow[];
};

export function PosScreen({ recentSales, ...posProps }: PosScreenProps) {
  // Lo que devuelve checkoutSale pisa la lista del servidor, pero sólo
  // mientras el servidor no mande una más nueva (p. ej. después de anular
  // una venta, que sí hace router.refresh()): `base` recuerda sobre qué
  // lista del servidor se armó la copia local.
  const [live, setLive] = useState<{ base: SaleRow[]; rows: SaleRow[] }>({
    base: recentSales,
    rows: recentSales,
  });
  const rows = live.base === recentSales ? live.rows : recentSales;

  return (
    <div className="space-y-6">
      <PosClient
        {...posProps}
        onSaleCompleted={(next) => setLive({ base: recentSales, rows: next })}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventas recientes de esta caja</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <VentasList
            sales={rows}
            paymentLabels={paymentLabels}
            emptyLabel="Todavía no cobraste ninguna venta en esta caja."
          />
        </CardContent>
      </Card>
    </div>
  );
}
