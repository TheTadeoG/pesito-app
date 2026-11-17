"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { ProductosClient } from "@/app/(dashboard)/productos/productos-client";

const base = { org_id: "o1", category_id: null, image_url: null, default_supplier_id: null, package_label: null, pack_size: null, active: true, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z" };
const products = [
  { ...base, id: "p1", name: "Gaseosa cola 500 ml", barcode: "7790000000011", sku: "P-00001", price: 1800, cost: 1100, stock: 24, min_stock: 6, unit: "u", brand: "Cola Cola" },
  { ...base, id: "p2", name: "Alfajor triple", barcode: "7790000000028", sku: "P-00002", price: 1200, cost: 700, stock: 40, min_stock: 10, unit: "u", brand: "Dulcor" },
  { ...base, id: "p3", name: "Agua mineral 1,5 L", barcode: "7790000000035", sku: "P-00003", price: 1500, cost: 900, stock: 3, min_stock: 6, unit: "u", brand: "Aguas del Sur" },
  { ...base, id: "p4", name: "Papas fritas 100 g", barcode: null, sku: "P-00004", price: 2100, cost: 1300, stock: 18, min_stock: 6, unit: "u", brand: "Crocante" },
  { ...base, id: "p5", name: "Yerba mate 1 kg", barcode: "7790000000059", sku: "P-00005", price: 6200, cost: 4300, stock: 12, min_stock: 4, unit: "u", brand: "La Pampa" },
];

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto min-h-[470px] max-w-6xl bg-background p-4">
        <ProductosClient
          orgId="o1"
          products={products as never}
          brands={[{ id: "b1", name: "Cola Cola" }, { id: "b2", name: "Dulcor" }]}
          suppliers={[{ id: "s1", name: "Distribuidora Norte" }]}
          initialBrand={null}
          bulkLocked={false}
          inventoryLocked={false}
          variantsLocked={false}
          bundlesLocked={false}
          bundleItems={{}}
          revertLocked={false}
          productUsage={{ used: 5, limit: 4000, nextPlan: null }}
          stockAlertsLocked={false}
          importLocked={false}
          labelsLocked={false}
          canManageCatalog
          restockLocked={false}
          initialStockState={null}
          initialAlertsOpen={false}
          idFilter={null}
          idleDays={90}
          idleAllowed={false}
        />
      </div>
    </ToastProvider>
  );
}
