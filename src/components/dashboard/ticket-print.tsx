"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Ticket, type SaleReceipt } from "@/app/(dashboard)/pos/sale-done-dialog";

/**
 * Imprime un ticket (80 mm) de una venta ya hecha: lo monta en el body (globals.css oculta todo lo demás al
 * imprimir, ver .ticket-print), abre la impresión y avisa con `onDone` al terminar o cancelar.
 */
export function TicketPrint({ receipt, onDone }: { receipt: SaleReceipt | null; onDone: () => void }) {
  useEffect(() => {
    if (!receipt) return;
    const done = () => onDone();
    window.addEventListener("afterprint", done);
    // Un instante para que el ticket quede dibujado antes de abrir la impresión.
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [receipt, onDone]);

  if (!receipt) return null;
  return createPortal(<Ticket receipt={receipt} />, document.body);
}
