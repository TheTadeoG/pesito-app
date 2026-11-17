"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { StartCard } from "@/app/(dashboard)/inventario-fisico/start-card";

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto max-w-3xl bg-background p-4">
        <StartCard
          branchName={null}
          brands={["Cola Cola", "Dulcor", "Crocante"]}
          suppliers={[{ id: "s1", name: "Distribuidora Norte" }]}
          history={[{ id: "h1", name: "Inventario de fin de mes", branch: null, appliedAt: "2026-10-31T21:00:00Z", adjusted: 12, plus: 4, minus: 8 }]}
        />
      </div>
    </ToastProvider>
  );
}
