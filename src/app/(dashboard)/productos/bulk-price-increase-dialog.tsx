"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast/toast-provider";
import { bulkIncreasePriceBySupplier } from "@/app/(dashboard)/productos/actions";
import type { Product, Supplier } from "@/lib/types";

type SupplierOption = Pick<Supplier, "id" | "name">;

export function BulkPriceIncreaseDialog({
  open,
  onClose,
  suppliers,
  products,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: SupplierOption[];
  products: Product[];
}) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const affectedCount = useMemo(() => {
    if (!supplierId) return 0;
    return products.filter((p) => p.active && p.default_supplier_id === supplierId).length;
  }, [products, supplierId]);

  function resetAndClose() {
    setSupplierId("");
    setMode("percent");
    setValue("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      setError("Elegí un proveedor.");
      return;
    }
    if (affectedCount === 0) {
      setError("Ese proveedor no tiene productos activos asignados como proveedor por defecto.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await bulkIncreasePriceBySupplier(supplierId, mode, Number(value));
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    showSuccess(
      "Precios actualizados",
      `Se actualizaron ${result.updatedCount ?? 0} producto${result.updatedCount === 1 ? "" : "s"}.`
    );
    router.refresh();
    resetAndClose();
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      title="Aumentar precios por proveedor"
      description="Actualiza de una el precio de venta de todos los productos activos que tengan a ese proveedor como proveedor por defecto."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="bpi-supplier">Proveedor</Label>
          <Select
            id="bpi-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Elegí un proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {supplierId && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {affectedCount === 0
                ? "Ningún producto activo tiene a este proveedor como proveedor por defecto."
                : `Afecta a ${affectedCount} producto${affectedCount === 1 ? "" : "s"}.`}
            </p>
          )}
        </div>

        <div>
          <Label>Tipo de aumento</Label>
          <div className="mt-1.5 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setMode("percent")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
                mode === "percent"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Porcentaje (%)
            </button>
            <button
              type="button"
              onClick={() => setMode("fixed")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
                mode === "fixed"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monto fijo ($)
            </button>
          </div>
        </div>

        <div>
          <Label htmlFor="bpi-value">
            {mode === "percent" ? "Porcentaje a aumentar" : "Monto a sumar a cada precio"}
          </Label>
          <Input
            id="bpi-value"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "percent" ? "Ej: 10" : "Ej: 500"}
            autoFocus
          />
        </div>

        {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !supplierId || !value}>
            {pending ? "Actualizando…" : "Aumentar precios"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
