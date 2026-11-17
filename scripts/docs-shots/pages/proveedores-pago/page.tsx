"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { SupplierPaymentDialog } from "@/app/(dashboard)/proveedores/supplier-payment-dialog";

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="min-h-[300px] bg-background" />
      <SupplierPaymentDialog
        supplier={{ id: "s1", name: "Distribuidora Norte", balance: 54000 } as never}
        items={[
          { purchaseId: "pu1", supplierId: "s1", amount: 30000, purchaseDay: day(-18), dueDate: day(-3), status: "vencida", daysToDue: -3, ageDays: 18 },
          { purchaseId: "pu2", supplierId: "s1", amount: 24000, purchaseDay: day(-5), dueDate: day(10), status: "no_vencida", daysToDue: 10, ageDays: 5 },
        ] as never}
        onClose={() => {}}
      />
    </ToastProvider>
  );
}
