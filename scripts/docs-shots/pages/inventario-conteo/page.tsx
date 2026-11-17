"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { CountClient } from "@/app/(dashboard)/inventario-fisico/count-client";

const products = [
  { id: "p1", name: "Gaseosa cola 500 ml", sku: "P-00001", barcode: "7790000000011", unit: "u", stock: 24 },
  { id: "p2", name: "Alfajor triple", sku: "P-00002", barcode: "7790000000028", unit: "u", stock: 40 },
  { id: "p3", name: "Agua mineral 1,5 L", sku: "P-00003", barcode: "7790000000035", unit: "u", stock: 3 },
  { id: "p4", name: "Papas fritas 100 g", sku: "P-00004", barcode: null, unit: "u", stock: 18 },
];

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto min-h-[520px] max-w-5xl bg-background p-4">
        <CountClient
          countId="c1"
          name="Inventario de fin de mes"
          scope="todo"
          branchName={null}
          products={products}
          initialItems={[
            { productId: "p1", counted: 24, expected: 24 },
            { productId: "p2", counted: 38, expected: 40 },
          ]}
        />
      </div>
    </ToastProvider>
  );
}
