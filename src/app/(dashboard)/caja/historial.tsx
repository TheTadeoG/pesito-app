"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
import { getCajaDetail, type CajaDetail } from "@/app/(dashboard)/caja/actions";
import { CajaDetailDialog } from "@/app/(dashboard)/caja/caja-detail-dialog";
import type { PaymentBreakdownRow } from "@/lib/caja";

export interface CajaHistorialRow {
  id: string;
  userLabel: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  expectedAmount: number;
  closingAmount: number;
  paymentBreakdown: PaymentBreakdownRow[];
}

export function CajaHistorial({ rows }: { rows: CajaHistorialRow[] }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CajaDetail | null>(null);

  async function openDetail(cashRegisterId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    const result = await getCajaDetail(cashRegisterId);
    setDetailLoading(false);
    setDetail(result.detail ?? null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de caja</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no cerraste ninguna caja.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => {
              const diff = row.closingAmount - row.expectedAmount;
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetail(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(row.id);
                    }
                  }}
                  className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{row.userLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(row.openedAt)} → {formatDateTime(row.closedAt)}
                    </p>
                    {row.paymentBreakdown.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.paymentBreakdown.map((p) => (
                          <span
                            key={p.method}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {paymentLabels[p.method] ?? p.method}: {formatCurrency(p.total)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 text-right text-xs text-muted-foreground">
                    <p>Inicial: {formatCurrency(row.openingAmount)}</p>
                    <p>Efectivo esperado: {formatCurrency(row.expectedAmount)}</p>
                    <p className="font-medium text-foreground">
                      Efectivo contado: {formatCurrency(row.closingAmount)}
                    </p>
                  </div>
                  {diff === 0 ? (
                    <Badge tone="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Sin diferencia
                    </Badge>
                  ) : (
                    <Badge tone={diff > 0 ? "success" : "danger"}>
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {diff > 0 ? "+" : ""}
                      {formatCurrency(diff)}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <CajaDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        detail={detail}
      />
    </Card>
  );
}
