"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Store } from "lucide-react";
import { Select } from "@/components/ui/select";

// Filtro por sucursal de lo de abajo de Caja (equipo, faltantes e historial).
// Vive en la URL (?sucursal=) para poder compartir o recargar la vista.
export function BranchFilter({
  branches,
  value,
}: {
  branches: { id: string; name: string }[];
  value: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Cambia la sucursal sin perder el período elegido arriba.
  function go(branchId: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (branchId) p.set("sucursal", branchId);
    else p.delete("sucursal");
    const qs = p.toString();
    router.push(qs ? `/caja?${qs}` : "/caja");
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Store className="h-3.5 w-3.5" />
        Sucursal
      </span>
      <div className="w-full sm:w-56">
        <Select
          aria-label="Filtrar por sucursal"
          value={value ?? ""}
          onChange={(e) => go(e.target.value)}
          className={value ? "border-primary bg-accent" : undefined}
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <span className="text-xs text-muted-foreground">Filtra el equipo, los faltantes y el historial.</span>
    </div>
  );
}
