"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
import type { CashBreakdown, PaymentBreakdownRow } from "@/lib/caja";
import { addCashMovement, closeCaja, getCajaDetail, type CajaDetail } from "@/app/(dashboard)/caja/actions";
import { CajaDetailDialog } from "@/app/(dashboard)/caja/caja-detail-dialog";
import { CashCalculator } from "@/components/dashboard/cash-calculator";
import { useToast } from "@/components/toast/toast-provider";

type View = "closed" | "gestionar" | "ingreso" | "retiro" | "cerrar";

interface ManageCajaProps {
  cashRegisterId: string;
  openingAmount: number;
  cashOnHand: number;
  openedAt: string;
  openedByLabel: string;
  paymentBreakdown: PaymentBreakdownRow[];
  /** De dónde sale el efectivo (para el extracto "En caja ahora"). */
  cash: CashBreakdown;
}

export function ManageCaja({
  cashRegisterId,
  openingAmount,
  cashOnHand,
  openedAt,
  openedByLabel,
  paymentBreakdown,
  cash,
}: ManageCajaProps) {
  const router = useRouter();
  const { showSuccess } = useToast();
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
    // Si falla, el diálogo muestra "No pudimos cargar" en vez de quedar
    // cargando para siempre.
    const result = await getCajaDetail(cashRegisterId).catch(() => null);
    setDetailLoading(false);
    setDetail(result?.detail ?? null);
  }

  // Con la caja abierta y sin ningún diálogo activo, Enter lleva directo a
  // vender — no hace falta ni un click ni esperar un segundo Enter.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.repeat) return;
      if (view !== "closed" || detailOpen) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur();
      router.push("/pos");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, detailOpen, router]);

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
    showSuccess(
      type === "ingreso" ? "Ingreso registrado" : "Retiro registrado",
      formatCurrency(Number(amount) || 0)
    );
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
    showSuccess("¡Caja cerrada!", `Contado: ${formatCurrency(Number(countedAmount) || 0)}`);
    closeAndReset();
    router.refresh();
  }

  const diff = countedAmount === "" ? null : Number(countedAmount) - cashOnHand;
  const soldTotal = paymentBreakdown.reduce((acc, r) => acc + r.total, 0);

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-bg text-success">
            <LockOpen className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-sm font-semibold text-foreground">Caja abierta</p>
            <p className="truncate text-xs text-muted-foreground">
              Desde el {formatDateTime(openedAt)} · {openedByLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => router.push("/pos")}>
              <ShoppingCart className="h-4 w-4" />
              Vender (Enter)
            </Button>
            <Button variant="outline" onClick={() => setView("gestionar")}>
              <SlidersHorizontal className="h-4 w-4" />
              Ingresar / Retirar
            </Button>
            <Button variant="outline" onClick={openDetail}>
              <Eye className="h-4 w-4" />
              Ver detalle
            </Button>
            <Button variant="danger" onClick={() => setView("cerrar")}>
              <Calculator className="h-4 w-4" />
              Cerrar caja
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              En caja ahora
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">
              {formatCurrency(cashOnHand)}
            </p>
            <p className="text-sm text-muted-foreground">Es lo que tendría que haber en el cajón.</p>
            <div className="mt-4 divide-y divide-border text-sm">
              <ExtractRow label="Con lo que abriste" value={formatCurrency(cash.openingAmount)} />
              <ExtractRow
                label="+ Ventas en efectivo"
                value={`+ ${formatCurrency(cash.salesCashTotal)}`}
                tone="plus"
              />
              {cash.debtPaymentsTotal > 0 && (
                <ExtractRow
                  label="+ Cobros de fiado"
                  value={`+ ${formatCurrency(cash.debtPaymentsTotal)}`}
                  tone="plus"
                />
              )}
              {cash.ingresosTotal > 0 && (
                <ExtractRow
                  label="+ Ingresos de efectivo"
                  value={`+ ${formatCurrency(cash.ingresosTotal)}`}
                  tone="plus"
                />
              )}
              {cash.retirosTotal > 0 && (
                <ExtractRow
                  label="− Retiros"
                  value={`− ${formatCurrency(cash.retirosTotal)}`}
                  tone="minus"
                />
              )}
              {cash.supplierPaymentsTotal > 0 && (
                <ExtractRow
                  label="− Pagos a proveedores"
                  value={`− ${formatCurrency(cash.supplierPaymentsTotal)}`}
                  tone="minus"
                />
              )}
              {cash.cashPurchasesTotal > 0 && (
                <ExtractRow
                  label="− Compras pagadas en efectivo"
                  value={`− ${formatCurrency(cash.cashPurchasesTotal)}`}
                  tone="minus"
                />
              )}
              <div className="flex items-center justify-between border-t-2 border-foreground py-2.5 font-bold text-foreground">
                <span>= En caja</span>
                <span>{formatCurrency(cashOnHand)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vendido en este turno
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">
              {formatCurrency(soldTotal)}
            </p>
            <p className="text-sm text-muted-foreground">
              {paymentBreakdown.some((r) => r.method === "fiado")
                ? "Incluye lo vendido a fiado (pendiente de cobro)."
                : "Todo lo cobrado desde que abriste."}
            </p>
            {paymentBreakdown.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Todavía no hay ventas en este turno.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {paymentBreakdown.map((row) => (
                  <div key={row.method}>
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>
                        {paymentLabels[row.method] ?? row.method}
                        {row.method === "fiado" && (
                          <span className="font-normal text-muted-foreground"> · pendiente de cobro</span>
                        )}
                      </span>
                      <span>{formatCurrency(row.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className={row.method === "fiado" ? "h-1.5 rounded-full bg-warning" : "h-1.5 rounded-full bg-primary"}
                        style={{ width: `${soldTotal > 0 ? Math.max(3, (row.total / soldTotal) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (amount && !pending) handleMovement(view === "ingreso" ? "ingreso" : "retiro");
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Monto <span className="font-normal text-muted-foreground">(Enter confirma)</span>
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
            <Button type="submit" disabled={pending || !amount}>
              {pending ? "Guardando…" : "Confirmar (Enter)"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={view === "cerrar"}
        onClose={closeAndReset}
        title="Cerrar Caja"
        description="Contá todo el efectivo en caja y verificá que coincida con el monto esperado."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (countedAmount && !pending) handleClose();
          }}
        >
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
              Monto real contado{" "}
              <span className="font-normal text-muted-foreground">(Enter confirma)</span>
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <CashCalculator onUseTotal={(total) => setCountedAmount(String(total))} />

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
            <Button type="submit" variant="primary" disabled={pending || !countedAmount}>
              <Calculator className="h-4 w-4" />
              {pending ? "Cerrando…" : "Cerrar Caja (Enter)"}
            </Button>
          </div>
        </form>
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

function ExtractRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "plus" | "minus";
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-foreground">{label}</span>
      <span
        className={
          tone === "plus"
            ? "font-semibold text-success"
            : tone === "minus"
              ? "font-semibold text-danger"
              : "font-semibold text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
