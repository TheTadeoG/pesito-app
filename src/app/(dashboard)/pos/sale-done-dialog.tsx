"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Printer } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface SaleReceipt {
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
}

// Ticket para impresoras térmicas (58 u 80 mm). Se monta en document.body y
// globals.css oculta todo lo demás al imprimir (ver .ticket-print).
function Ticket({ receipt }: { receipt: SaleReceipt }) {
  const change =
    receipt.cashReceived !== null ? Math.max(0, receipt.cashReceived - receipt.total) : 0;
  return (
    <div className="ticket-print">
      <p className="ticket-center ticket-bold ticket-big">{receipt.orgName}</p>
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

export function SaleDoneDialog({
  receipt,
  onClose,
}: {
  receipt: SaleReceipt | null;
  onClose: () => void;
}) {
  const newSaleRef = useRef<HTMLButtonElement>(null);

  // Enter o Escape cierran y siguen vendiendo. Cualquier otra tecla (el
  // lector de códigos "tipea") también cierra: el POS manda esa tecla al
  // buscador, así que escanear el próximo producto no se pierde.
  useEffect(() => {
    if (!receipt) return;
    function handleKeyDown(e: KeyboardEvent) {
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
  }, [receipt, onClose]);

  useEffect(() => {
    if (receipt) newSaleRef.current?.focus();
  }, [receipt]);

  if (!receipt) return null;

  const change =
    receipt.cashReceived !== null ? Math.max(0, receipt.cashReceived - receipt.total) : 0;

  return (
    <>
      <Dialog open onClose={onClose} title="¡Venta cobrada!">
        <div className="space-y-5">
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

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimir ticket
            </Button>
            <Button ref={newSaleRef} type="button" onClick={onClose}>
              Nueva venta (Enter)
            </Button>
          </div>

        </div>
      </Dialog>
      {createPortal(<Ticket receipt={receipt} />, document.body)}
    </>
  );
}
