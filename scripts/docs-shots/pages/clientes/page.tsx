"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { ClientesClient } from "@/app/(dashboard)/clientes/clientes-client";

const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const base = { org_id: "o1", razon_social: null, email: null, document: null, notes: null, invoice_type: null, created_at: day(90) };
const customers = [
  { ...base, id: "c1", name: "María González", phone: "11 2345-6789", balance: 0, debtSince: null, lastPaymentAt: day(3), lastSaleAt: day(1) },
  { ...base, id: "c2", name: "Kiosco El Sol", phone: "11 5555-1234", balance: 12500, debtSince: day(12), lastPaymentAt: day(20), lastSaleAt: day(2) },
  { ...base, id: "c3", name: "Pedro Sosa", phone: null, balance: 4300, debtSince: day(3), lastPaymentAt: null, lastSaleAt: day(3) },
  { ...base, id: "c4", name: "Almacén San Martín", phone: "11 4444-8800", balance: 0, debtSince: null, lastPaymentAt: day(9), lastSaleAt: day(5) },
];

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto min-h-[520px] max-w-6xl bg-background p-4">
        <ClientesClient customers={customers as never} canUseExcel />
      </div>
    </ToastProvider>
  );
}
