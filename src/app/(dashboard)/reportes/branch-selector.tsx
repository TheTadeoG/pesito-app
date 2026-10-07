"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { reportesHref, type ReportQuery } from "@/lib/report-periods";

export function BranchSelector({
  query,
  sellerId,
  branchId,
  branches,
}: {
  query: ReportQuery;
  sellerId: string | null;
  branchId: string | null;
  branches: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <div className="w-full sm:w-56">
      <Select
        aria-label="Sucursal"
        value={branchId ?? ""}
        onChange={(e) => router.push(reportesHref(query, sellerId, e.target.value || null))}
        className={branchId ? "border-primary bg-accent" : undefined}
      >
        <option value="">Todas las sucursales</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
