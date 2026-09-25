"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { reportesHref, type ReportPeriod } from "@/lib/report-periods";

export function SellerSelector({
  period,
  sellerId,
  sellers,
  sellerLabel,
}: {
  period: ReportPeriod;
  sellerId: string | null;
  sellers: { id: string; label: string }[];
  sellerLabel: string | null;
}) {
  const router = useRouter();
  // Un vendedor que ya no está en el negocio no figura en la lista, pero se
  // puede llegar a él desde "Ventas por vendedor".
  const options =
    sellerId && !sellers.some((s) => s.id === sellerId)
      ? [...sellers, { id: sellerId, label: sellerLabel ?? "Usuario eliminado" }]
      : sellers;

  return (
    <div className="w-full sm:w-56">
      <Select
        aria-label="Vendedor"
        value={sellerId ?? ""}
        onChange={(e) => router.push(reportesHref(period, e.target.value || null))}
      >
        <option value="">Todos los vendedores</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
