"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { ManageCaja } from "@/app/(dashboard)/caja/manage-caja";

const now = new Date();
now.setHours(9, 0, 0, 0);
const at = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto min-h-[560px] max-w-5xl bg-background p-4">
        <ManageCaja
          cashRegisterId="r1"
          openingAmount={20000}
          cashOnHand={87400}
          openedAt={now.toISOString()}
          openedByLabel="Vos"
          paymentBreakdown={[
            { method: "efectivo", total: 74600 },
            { method: "tarjeta", total: 38200 },
            { method: "transferencia", total: 21500 },
          ]}
          cash={{ openingAmount: 20000, salesCashTotal: 74600, debtPaymentsTotal: 5000, ingresosTotal: 10000, retirosTotal: 15000, supplierPaymentsTotal: 5000, cashPurchasesTotal: 2200 }}
          movements={[
            { id: "m1", kind: "apertura", title: "Apertura", note: null, at: at(9, 0), amount: 20000 },
            { id: "m2", kind: "ventas", title: "Ventas en efectivo", note: "34 ventas", at: null, amount: 74600 },
            { id: "m3", kind: "ingreso", title: "Ingreso de efectivo", note: "Cambio", at: at(10, 30), amount: 10000 },
            { id: "m4", kind: "retiro", title: "Retiro de efectivo", note: "Pago a proveedor", at: at(13, 15), amount: -15000 },
          ]}
        />
      </div>
    </ToastProvider>
  );
}
