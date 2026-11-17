"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { PaymentDialog } from "@/app/(dashboard)/clientes/payment-dialog";

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="min-h-[300px] bg-background" />
      <PaymentDialog customer={{ id: "c2", name: "Kiosco El Sol", balance: 12500 } as never} onClose={() => {}} />
    </ToastProvider>
  );
}
