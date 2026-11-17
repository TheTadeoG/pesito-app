"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { PeriodSelector } from "@/app/(dashboard)/reportes/period-selector";

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <div id="shot" className="mx-auto min-h-[110px] max-w-5xl bg-background p-4">
      <PeriodSelector
        query={{ period: "month", from: null, to: null, compare: "previous" }}
        sellerId={null}
        rangeLabel="del 1/11/26 al 17/11/26"
        today="2026-11-17"
        canCustomRange
        canCompare
      />
    </div>
  );
}
