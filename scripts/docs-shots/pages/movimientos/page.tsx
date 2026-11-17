"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { MovementsTab } from "@/app/(dashboard)/productos/movements-tab";

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const base = { org_id: "o1", category_id: null, image_url: null, default_supplier_id: null, package_label: null, pack_size: null, active: true, created_at: ago(500), updated_at: ago(5), unit: "u", brand: null, barcode: null, cost: 1000, price: 1800, min_stock: 6 };
const products = [
  { ...base, id: "p1", name: "Gaseosa cola 500 ml", sku: "P-00001", stock: 24 },
  { ...base, id: "p2", name: "Alfajor triple", sku: "P-00002", stock: 40 },
  { ...base, id: "p3", name: "Agua mineral 1,5 L", sku: "P-00003", stock: 3 },
];
const mv = (id: string, product: number, type: string, quantity: number, h: number, reference: string | null, who: string) => ({
  id, product_id: "p" + product, type, quantity, reference, created_at: ago(h), product_name: products[product - 1].name, product_sku: products[product - 1].sku,
  product_barcode: null, user_label: who, unit: "u", stock_now: products[product - 1].stock,
});
const movements = [
  mv("m1", 1, "venta", -2, 1, null, "Lucía"),
  mv("m2", 2, "compra", 24, 3, "Compra a Distribuidora Norte", "Vos"),
  mv("m3", 3, "ajuste", -2, 5, "Rotura", "Vos"),
  mv("m4", 1, "venta", -1, 6, null, "Martín"),
  mv("m5", 2, "ajuste", 1, 8, "Anulación de venta 8f3c", "Vos"),
];

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto min-h-[480px] max-w-6xl bg-background p-4">
        <MovementsTab products={products as never} movements={movements as never} focusedProduct={null} />
      </div>
    </ToastProvider>
  );
}
