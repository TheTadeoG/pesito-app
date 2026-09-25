"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
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
  // Retiros manuales + compras y pagos a proveedores pagados en efectivo.
  egresosTotal: number;
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
    // Si falla, el diálogo muestra "No pudimos cargar" en vez de quedar
    // cargando para siempre.
    const result = await getCajaDetail(cashRegisterId).catch(() => null);
    setDetailLoading(false);
    setDetail(result?.detail ?? null);
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
              const openedDate = formatDate(row.openedAt);
              const closedDate = formatDate(row.closedAt);
              const sameDay = openedDate === closedDate;
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
                  className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted sm:flex-nowrap"
                >
                  <div className="w-20 shrink-0">
                    <p className="text-sm font-semibold text-foreground">{openedDate}</p>
                    {!sameDay && (
                      <p className="text-xs text-muted-foreground">→ {closedDate}</p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{row.userLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(row.openedAt)} → {formatTime(row.closedAt)}
                    </p>
                    {(row.paymentBreakdown.length > 0 || row.egresosTotal > 0) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.paymentBreakdown.map((p) => (
                          <span
                            key={p.method}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              p.method === "fiado"
                                ? "bg-warning-bg text-warning"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {paymentLabels[p.method] ?? p.method}
                            {p.method === "fiado" ? " (pendiente de cobro)" : ""}:{" "}
                            {formatCurrency(p.total)}
                          </span>
                        ))}
                        {row.egresosTotal > 0 && (
                          <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-medium text-danger">
                            Egresos: {formatCurrency(row.egresosTotal)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="w-48 shrink-0 space-y-0.5 text-right text-xs text-muted-foreground">
                    <p>Inicial: {formatCurrency(row.openingAmount)}</p>
                    <p>Efectivo esperado: {formatCurrency(row.expectedAmount)}</p>
                    <p className="font-medium text-foreground">
                      Efectivo contado: {formatCurrency(row.closingAmount)}
                    </p>
                  </div>
                  <div className="flex w-36 shrink-0 justify-end">
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
