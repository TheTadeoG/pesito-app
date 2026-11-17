"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { CajaResumen } from "@/app/(dashboard)/caja/team-overview";

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <div id="shot" className="mx-auto max-w-3xl bg-background p-4">
      <CajaResumen
        others={[
          { id: "o1", userLabel: "Lucía (turno mañana)", openedAt: ago(30), openingAmount: 15000, cashOnHand: 52300 },
          { id: "o2", userLabel: "Martín", openedAt: ago(4), openingAmount: 10000, cashOnHand: 28900 },
        ]}
        closeTime="21:00"
        fiado={{ total: 12500, count: 2 }}
        proveedores={{ total: 84000, count: 3, overdueSuppliers: 1 }}
        supplierPlan="pro"
        ownOpen
      />
    </div>
  );
}
