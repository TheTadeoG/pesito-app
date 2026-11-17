"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { ProveedoresClient } from "@/app/(dashboard)/proveedores/proveedores-client";

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const sbase = { org_id: "o1", email: null, notes: null, created_at: "2026-01-01T00:00:00Z" };
const item = (supplierId: string, amount: number, due: number | null, age: number) => ({
  purchaseId: "pu" + supplierId, supplierId, amount, purchaseDay: day(-age), dueDate: due === null ? null : day(due),
  status: due === null ? "sin_fecha" : due < 0 ? "vencida" : due === 0 ? "hoy" : "no_vencida", daysToDue: due, ageDays: age,
});
const rows = [
  { ...sbase, id: "s1", name: "Distribuidora Norte", phone: "11 4000-1111", balance: 54000, totalPurchased: 320000, lastPurchaseAt: new Date().toISOString(), items: [item("s1", 54000, -3, 18)] },
  { ...sbase, id: "s2", name: "Golosinas del Sur", phone: "11 4000-2222", balance: 24000, totalPurchased: 150000, lastPurchaseAt: new Date().toISOString(), items: [item("s2", 24000, 5, 10)] },
  { ...sbase, id: "s3", name: "Bebidas Central", phone: null, balance: 0, totalPurchased: 98000, lastPurchaseAt: new Date().toISOString(), items: [] },
];

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto min-h-[640px] max-w-6xl bg-background p-4">
        <ProveedoresClient overview={{ todayKey: day(0), rows, top: [], topTotal: 0 } as never} accountsEnabled />
      </div>
    </ToastProvider>
  );
}
