"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  DollarSign,
  Eye,
  LockOpen,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
import type { PaymentBreakdownRow } from "@/lib/caja";
import { addCashMovement, closeCaja, getCajaDetail, type CajaDetail } from "@/app/(dashboard)/caja/actions";
import { CajaDetailDialog } from "@/app/(dashboard)/caja/caja-detail-dialog";

type View = "closed" | "gestionar" | "ingreso" | "retiro" | "cerrar";

interface ManageCajaProps {
  cashRegisterId: string;
  openingAmount: number;
  cashOnHand: number;
  openedAt: string;
  openedByLabel: string;
  paymentBreakdown: PaymentBreakdownRow[];
}

export function ManageCaja({
  cashRegisterId,
  openingAmount,
  cashOnHand,
  openedAt,
  openedByLabel,
  paymentBreakdown,
}: ManageCajaProps) {
  const router = useRouter();
  const [view, setView] = useState<View>("closed");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [countedAmount, setCountedAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CajaDetail | null>(null);

  async function openDetail() {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    const result = await getCajaDetail(cashRegisterId);
    setDetailLoading(false);
    setDetail(result.detail ?? null);
  }

  function closeAndReset() {
    setView("closed");
    setAmount("");
    setReason("");
    setCountedAmount("");
    setError(null);
  }

  async function handleMovement(type: "ingreso" | "retiro") {
    setPending(true);
    setError(null);
    const result = await addCashMovement(cashRegisterId, type, Number(amount) || 0, reason);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeAndReset();
    router.refresh();
  }

  async function handleClose() {
    setPending(true);
    setError(null);
    const result = await closeCaja(cashRegisterId, Number(countedAmount) || 0);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeAndReset();
    router.refresh();
  }

  const diff = countedAmount === "" ? null : Number(countedAmount) - cashOnHand;

  return (
    <>
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-bg text-success">
            <LockOpen className="h-7 w-7" />
          </span>
          <Badge tone="success">Caja abierta</Badge>
          <h2 className="text-sm text-muted-foreground">Efectivo disponible</h2>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(cashOnHand)}</p>
          <p className="text-xs text-muted-foreground">
            Abierta el {formatDateTime(openedAt)} · {openedByLabel}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={() => router.push("/pos")}>
              <ShoppingCart className="h-4 w-4" />
              Vender
            </Button>
            <Button variant="outline" onClick={() => setView("gestionar")}>
              <SlidersHorizontal className="h-4 w-4" />
              Gestionar Caja
            </Button>
            <Button variant="outline" onClick={openDetail}>
              <Eye className="h-4 w-4" />
              Ver detalle
            </Button>
          </div>
        </CardContent>
      </Card>

      {paymentBreakdown.length > 0 && (
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="text-base">Ventas de esta caja por medio de pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paymentBreakdown.map((row) => (
              <div key={row.method} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {paymentLabels[row.method] ?? row.method}
                </span>
                <span className="font-semibold text-foreground">{formatCurrency(row.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={view === "gestionar"}
        onClose={closeAndReset}
        title="Gestionar caja"
        description="Revisá tu efectivo disponible y elegí una acción para continuar."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Efectivo disponible</span>
            <span className="flex items-center gap-1 text-lg font-bold text-foreground">
              {formatCurrency(cashOnHand)}
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </span>
          </div>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setView("ingreso")}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Ingresar efectivo
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setView("retiro")}
          >
            <ArrowDownCircle className="h-4 w-4" />
            Retirar efectivo
          </Button>
          <Button variant="danger" className="w-full" onClick={() => setView("cerrar")}>
            <Calculator className="h-4 w-4" />
            Cerrar caja
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={view === "ingreso" || view === "retiro"}
        onClose={closeAndReset}
        title={view === "ingreso" ? "Ingresar efectivo" : "Retirar efectivo"}
        description={
          view === "ingreso"
            ? "Sumá efectivo a tu caja (ej: cambio, reposición)."
            : "Sacá efectivo de tu caja (ej: pago a un proveedor)."
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Monto</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && amount && !pending) {
                  handleMovement(view === "ingreso" ? "ingreso" : "retiro");
                }
              }}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Motivo (opcional)
            </label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          {error && (
            <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setView("gestionar")}>
              Volver
            </Button>
            <Button
              disabled={pending || !amount}
              onClick={() => handleMovement(view === "ingreso" ? "ingreso" : "retiro")}
            >
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={view === "cerrar"}
        onClose={closeAndReset}
        title="Cerrar Caja"
        description="Contá todo el efectivo en caja y verificá que coincida con el monto esperado."
      >
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-border px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Abierta por:</span>
              <span className="font-medium text-foreground">{openedByLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Apertura:</span>
              <span className="font-medium text-foreground">{formatDateTime(openedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monto inicial:</span>
              <span className="font-medium text-foreground">{formatCurrency(openingAmount)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Monto esperado en caja:</span>
            <span className="text-lg font-bold text-success">{formatCurrency(cashOnHand)}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Monto real contado
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && countedAmount && !pending) {
                  handleClose();
                }
              }}
              placeholder="0.00"
            />
          </div>

          {diff !== null && diff !== 0 && (
            <div className="flex items-center justify-between rounded-xl bg-warning-bg px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-warning">
                <AlertTriangle className="h-4 w-4" />
                Diferencia detectada
              </span>
              <span className="text-right">
                <Badge tone={diff > 0 ? "success" : "danger"}>
                  {diff > 0 ? "+" : ""}
                  {formatCurrency(diff)}
                </Badge>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {diff > 0 ? "Sobrante de efectivo" : "Faltante de efectivo"}
                </span>
              </span>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={closeAndReset}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={pending || !countedAmount} onClick={handleClose}>
              <Calculator className="h-4 w-4" />
              {pending ? "Cerrando…" : "Cerrar Caja"}
            </Button>
          </div>
        </div>
      </Dialog>

      <CajaDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        detail={detail}
      />
    </>
  );
}
