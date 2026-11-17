"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { ComprasClient } from "@/app/(dashboard)/compras/compras-client";

const products = [
  { id: "p1", name: "Gaseosa cola 500 ml", barcode: "7790000000011", sku: "P-00001", cost: 1100, price: 1800, stock: 24, min_stock: 6, unit: "u", image_url: null },
  { id: "p2", name: "Alfajor triple", barcode: "7790000000028", sku: "P-00002", cost: 700, price: 1200, stock: 40, min_stock: 10, unit: "u", image_url: null },
  { id: "p3", name: "Agua mineral 1,5 L", barcode: "7790000000035", sku: "P-00003", cost: 900, price: 1500, stock: 3, min_stock: 6, unit: "u", image_url: null },
];
const suppliers = [
  { id: "s1", name: "Distribuidora Norte", balance: 0, payment_terms_days: 15 },
  { id: "s2", name: "Golosinas del Sur", balance: 24000, payment_terms_days: 0 },
];

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto min-h-[640px] max-w-6xl bg-background p-4">
        <ComprasClient orgId="o1" products={products} suppliers={suppliers} hasOpenCaja customPaymentMethods={[]} supplierAccountsEnabled />
      </div>
    </ToastProvider>
  );
}
