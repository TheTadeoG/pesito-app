"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, FileText, Printer } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VoucherDialog, type VoucherFormat } from "@/components/dashboard/voucher-view";
import { issueSaleInvoice, type InvoicingConfig } from "@/lib/actions/invoicing";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface SaleReceipt {
  /** Para facturar la venta (sólo ventas recién cobradas en el POS). */
  saleId?: string;
  paymentMethod?: string;
  orgName: string;
  soldAt: string;
  lines: { name: string; quantity: number; unitPrice: number; subtotal: number; unit?: string }[];
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  payments: { label: string; amount: number }[];
  // Sólo en efectivo, si el cliente pagó con más de lo justo.
  cashReceived: number | null;
  customerName: string | null;
  /** Reimpresión desde el historial: el ticket dice «COPIA». */
  copy?: boolean;
  /** Venta anulada: el ticket lo dice bien grande. */
  voided?: boolean;
}

// Ticket para impresoras térmicas (58 u 80 mm). Se monta en document.body y
// globals.css oculta todo lo demás al imprimir (ver .ticket-print).
export function Ticket({ receipt }: { receipt: SaleReceipt }) {
  const change =
    receipt.cashReceived !== null ? Math.max(0, receipt.cashReceived - receipt.total) : 0;
  return (
    <div className="ticket-print">
      {receipt.voided && <p className="ticket-center ticket-bold ticket-big">VENTA ANULADA</p>}
      <p className="ticket-center ticket-bold ticket-big">{receipt.orgName}</p>
      {receipt.copy && <p className="ticket-center ticket-bold">COPIA</p>}
      <p className="ticket-center">{formatDateTime(receipt.soldAt)}</p>
      {receipt.customerName && <p className="ticket-center">Cliente: {receipt.customerName}</p>}
      <hr />
      {receipt.lines.map((line, i) => (
        <div key={i} className="ticket-line">
          <p>{line.name}</p>
          <p className="ticket-row">
            <span>
              {line.quantity}
              {line.unit ?? ""} x {formatCurrency(line.unitPrice)}
            </span>
            <span>{formatCurrency(line.subtotal)}</span>
          </p>
        </div>
      ))}
      <hr />
      {(receipt.discount > 0 || receipt.surcharge > 0) && (
        <p className="ticket-row">
          <span>Subtotal</span>
          <span>{formatCurrency(receipt.subtotal)}</span>
        </p>
      )}
      {receipt.discount > 0 && (
        <p className="ticket-row">
          <span>Descuento</span>
          <span>-{formatCurrency(receipt.discount)}</span>
        </p>
      )}
      {receipt.surcharge > 0 && (
        <p className="ticket-row">
          <span>Recargo</span>
          <span>{formatCurrency(receipt.surcharge)}</span>
        </p>
      )}
      <p className="ticket-row ticket-bold ticket-big">
        <span>TOTAL</span>
        <span>{formatCurrency(receipt.total)}</span>
      </p>
      {receipt.payments.map((p, i) => (
        <p key={i} className="ticket-row">
          <span>{p.label}</span>
          <span>{formatCurrency(p.amount)}</span>
        </p>
      ))}
      {receipt.cashReceived !== null && change > 0 && (
        <>
          <p className="ticket-row">
            <span>Recibido</span>
            <span>{formatCurrency(receipt.cashReceived)}</span>
          </p>
          <p className="ticket-row">
            <span>Vuelto</span>
            <span>{formatCurrency(change)}</span>
          </p>
        </>
      )}
      <hr />
      <p className="ticket-center">¡Gracias por su compra!</p>
      <p className="ticket-center ticket-small">Comprobante no válido como factura</p>
    </div>
  );
}

type InvoiceState = { saleId: string; phase: "working" | "done" | "error"; voucherId?: string; message?: string };

export function SaleDoneDialog({
  receipt,
  onClose,
  invoicing,
  onInvoiced,
}: {
  receipt: SaleReceipt | null;
  onClose: () => void;
  invoicing?: InvoicingConfig;
  onInvoiced?: (saleId: string, badge: string) => void;
}) {
  const newSaleRef = useRef<HTMLButtonElement>(null);
  const [invoice, setInvoice] = useState<InvoiceState | null>(null);
  const [viewVoucher, setViewVoucher] = useState<{ id: string; format: VoucherFormat } | null>(null);
  const autoStarted = useRef<string | null>(null);
  const saleId = receipt?.saleId;
  const canInvoice = Boolean(invoicing?.enabled && saleId);
  const isAuto = Boolean(canInvoice && receipt?.paymentMethod && invoicing?.autoMethods.includes(receipt.paymentMethod));

  // La venta ya está cobrada: facturar corre aparte y, si ARCA falla, la venta sigue igual (queda para
  // facturar a mano desde acá o desde el historial). El servidor no duplica una factura de la misma venta.
  const emit = useCallback(async (id: string) => {
    setInvoice({ saleId: id, phase: "working" });
    const res = await issueSaleInvoice(id);
    if (res.status === "authorized") {
      setInvoice({ saleId: id, phase: "done", voucherId: res.voucherId });
      if (res.badge) onInvoiced?.(id, res.badge);
    } else setInvoice({ saleId: id, phase: "error", message: res.error ?? "No pudimos facturar." });
  }, [onInvoiced]);

  useEffect(() => {
    if (!isAuto || !saleId || autoStarted.current === saleId) return;
    autoStarted.current = saleId;
    void emit(saleId);
  }, [isAuto, saleId, emit]);

  // Enter o Escape cierran y siguen vendiendo. Cualquier otra tecla (el
  // lector de códigos "tipea") también cierra: el POS manda esa tecla al
  // buscador, así que escanear el próximo producto no se pierde.
  // P (o Ctrl/⌘ + P) imprime el ticket (la ventana sigue abierta).
  useEffect(() => {
    if (!receipt || viewVoucher) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) window.print();
        return;
      }
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1) onClose();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [receipt, viewVoucher, onClose]);

  useEffect(() => {
    if (receipt) newSaleRef.current?.focus();
  }, [receipt]);

  if (!receipt) return null;

  const change =
    receipt.cashReceived !== null ? Math.max(0, receipt.cashReceived - receipt.total) : 0;

  return (
    <>
      <Dialog open onClose={onClose} title="¡Venta cobrada!">
        <div data-tour="sale-done" className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-success-bg px-4 py-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(receipt.total)}</p>
              <p className="text-sm text-muted-foreground">
                {receipt.payments.map((p) => p.label).join(" + ")}
                {receipt.customerName && ` · ${receipt.customerName}`}
              </p>
            </div>
          </div>

          {change > 0 && (
            <div className="rounded-xl border border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Vuelto (pagó con {formatCurrency(receipt.cashReceived ?? 0)})
              </p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(change)}</p>
            </div>
          )}

          {canInvoice && saleId && (
            <div className="rounded-xl border border-border px-4 py-3 text-sm">
              {invoice?.phase === "working" && <p className="text-muted-foreground">Facturando en ARCA…</p>}
              {invoice?.phase === "done" && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Factura electrónica emitida
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => invoice.voucherId && setViewVoucher({ id: invoice.voucherId, format: "ticket" })}>
                      <FileText className="h-4 w-4" />
                      Factura en ticket 80 mm
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => invoice.voucherId && setViewVoucher({ id: invoice.voucherId, format: "a4" })}>
                      <FileText className="h-4 w-4" />
                      Factura en hoja A4
                    </Button>
                  </div>
                </div>
              )}
              {invoice?.phase === "error" && (
                <div className="space-y-2">
                  <p className="text-danger">{invoice.message}</p>
                  <p className="text-xs text-muted-foreground">La venta quedó cobrada. Podés reintentar ahora o facturarla después desde Ventas.</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void emit(saleId)}>
                    Reintentar
                  </Button>
                </div>
              )}
              {!invoice && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-foreground">Esta venta no se factura sola.</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void emit(saleId)}>
                    <FileText className="h-4 w-4" />
                    Facturar
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimir ticket (no fiscal)
              <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline">
                P
              </kbd>
            </Button>
            <Button ref={newSaleRef} type="button" onClick={onClose}>
              Nueva venta (Enter)
            </Button>
          </div>

        </div>
      </Dialog>
      <VoucherDialog voucherId={viewVoucher?.id ?? null} initialFormat={viewVoucher?.format} onClose={() => setViewVoucher(null)} />
      {createPortal(<Ticket receipt={receipt} />, document.body)}
    </>
  );
}
