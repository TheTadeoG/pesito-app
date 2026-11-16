"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ticket, type SaleReceipt } from "@/app/(dashboard)/pos/sale-done-dialog";
import { printReceiptDirect } from "@/lib/receipt-escpos";

/**
 * Imprime un ticket (80 mm) de una venta ya hecha: lo monta en el body (globals.css oculta todo lo demás al
 * imprimir, ver .ticket-print), abre la impresión y avisa con `onDone` al terminar o cancelar.
 */
export function TicketPrint({ receipt, onDone }: { receipt: SaleReceipt | null; onDone: () => void }) {
  // Primero se prueba la impresora térmica conectada (directo, sin diálogo); si no hay o falla, se usa el diálogo del navegador.
  const [browser, setBrowser] = useState(false);
  useEffect(() => {
    if (!receipt) return;
    let cancelled = false;
    void printReceiptDirect(receipt).then((ok) => {
      if (cancelled) return;
      if (ok) onDone();
      else setBrowser(true);
    });
    return () => {
      cancelled = true;
      setBrowser(false);
    };
  }, [receipt, onDone]);

  useEffect(() => {
    if (!receipt || !browser) return;
    const done = () => onDone();
    window.addEventListener("afterprint", done);
    // Un instante para que el ticket quede dibujado antes de abrir la impresión.
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [receipt, browser, onDone]);

  if (!receipt || !browser) return null;
  return createPortal(<Ticket receipt={receipt} />, document.body);
}
