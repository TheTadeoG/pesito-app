"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
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

export function CajaHistorial({
  rows,
  limitedTo,
}: {
  rows: CajaHistorialRow[];
  /** El plan no incluye el historial completo: sólo se ven los últimos N cierres. */
  limitedTo?: number;
}) {
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
        <p className="text-xs text-muted-foreground">Tocá un cierre para ver el detalle.</p>
        {limitedTo !== undefined && (
          <p className="text-xs text-muted-foreground">
            {`Ves los últimos ${limitedTo} cierres. El historial completo está en el Plan Pro. `}
            <Link href="/suscribirse?plan=pro" prefetch={false} className="font-medium text-primary hover:underline">
              Pasate al Plan Pro
            </Link>
          </p>
        )}
      </CardHeader>
      <div className="pt-3">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no cerraste ninguna caja.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-5 py-2">Fecha</th>
                  <th className="px-3 py-2">Quién</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Horario</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">Esperado</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">Contado</th>
                  <th className="px-5 py-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const diff = row.closingAmount - row.expectedAmount;
                  const openedDate = formatDate(row.openedAt);
                  const closedDate = formatDate(row.closedAt);
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => openDetail(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(row.id);
                        }
                      }}
                      className="cursor-pointer hover:bg-muted"
                    >
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-foreground">
                        {openedDate}
                        {openedDate !== closedDate && (
                          <span className="text-xs font-normal text-muted-foreground">{` → ${closedDate}`}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-foreground">{row.userLabel}</td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-muted-foreground sm:table-cell">
                        {`${formatTime(row.openedAt)} → ${formatTime(row.closedAt)}`}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-right text-foreground md:table-cell">
                        {formatCurrency(row.expectedAmount)}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-right text-foreground md:table-cell">
                        {formatCurrency(row.closingAmount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {diff === 0 ? (
                          <Badge tone="success">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Sin diferencia
                          </Badge>
                        ) : (
                          <Badge tone={diff > 0 ? "warning" : "danger"}>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {diff > 0 ? "+ " : "− "}
                            {formatCurrency(Math.abs(diff))}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CajaDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        detail={detail}
      />
    </Card>
  );
}
