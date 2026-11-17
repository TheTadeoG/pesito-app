"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { PosClient } from "@/app/(dashboard)/pos/pos-client";

const products = [
  { id: "p1", name: "Gaseosa cola 500 ml", barcode: "7790000000011", sku: "P-00001", price: 1800, stock: 24, min_stock: 6, unit: "u", image_url: null },
  { id: "p2", name: "Alfajor triple", barcode: "7790000000028", sku: "P-00002", price: 1200, stock: 40, min_stock: 10, unit: "u", image_url: null },
  { id: "p3", name: "Agua mineral 1,5 L", barcode: "7790000000035", sku: "P-00003", price: 1500, stock: 3, min_stock: 6, unit: "u", image_url: null },
  { id: "p4", name: "Papas fritas 100 g", barcode: "7790000000042", sku: "P-00004", price: 2100, stock: 18, min_stock: 6, unit: "u", image_url: null },
  { id: "p5", name: "Yerba mate 1 kg", barcode: "7790000000059", sku: "P-00005", price: 6200, stock: 12, min_stock: 4, unit: "u", image_url: null },
  { id: "p6", name: "Combo merienda", barcode: null, sku: "C-00001", price: 4500, stock: 8, min_stock: 0, unit: "u", image_url: null },
];
const customers = [
  { id: "c1", name: "María González", invoice_type: null, balance: 0 },
  { id: "c2", name: "Kiosco El Sol", invoice_type: null, balance: 12500 },
];

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto max-w-6xl bg-background p-4">
        <PosClient
          orgId="o1"
          orgName="Kiosco Don José"
          cashRegisterId="r1"
          products={products}
          customers={customers}
          autoInvoiceByPayment={false}
          invoicing={{ enabled: false } as never}
          ticketShowNumber
          customPaymentMethods={[]}
          bundleInfo={{ p6: [{ componentId: "p1", quantity: 1 }, { componentId: "p4", quantity: 1 }] }}
          onSaleCompleted={() => {}}
        />
      </div>
    </ToastProvider>
  );
}
