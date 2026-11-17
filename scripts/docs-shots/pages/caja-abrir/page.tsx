"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { OpenCajaFormDialog } from "@/app/(dashboard)/caja/open-caja-dialog";

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="min-h-[300px] bg-background" />
      <OpenCajaFormDialog open onClose={() => {}} />
    </ToastProvider>
  );
}
