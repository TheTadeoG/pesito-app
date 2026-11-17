"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { PrinterSettingsCard } from "@/app/(dashboard)/configuracion/printer-settings";

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto max-w-2xl bg-background p-4">
        <PrinterSettingsCard />
      </div>
    </ToastProvider>
  );
}
