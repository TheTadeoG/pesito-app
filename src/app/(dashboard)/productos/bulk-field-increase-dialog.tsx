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
import { bulkIncreaseField } from "@/app/(dashboard)/productos/actions";
import type { Brand, Product, Supplier } from "@/lib/types";

type SupplierOption = Pick<Supplier, "id" | "name">;
type BrandOption = Pick<Brand, "id" | "name">;
type GroupBy = "supplier" | "brand";

export function BulkFieldIncreaseDialog({
  open,
  onClose,
  field,
  suppliers,
  brands,
  products,
}: {
  open: boolean;
  onClose: () => void;
  field: "price" | "cost";
  suppliers: SupplierOption[];
  brands: BrandOption[];
  products: Product[];
}) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [groupBy, setGroupBy] = useState<GroupBy>("supplier");
  const [supplierId, setSupplierId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldLabel = field === "price" ? "precio" : "costo";
  const fieldLabelCap = field === "price" ? "Precio" : "Costo";

  const affectedCount = useMemo(() => {
    const activeProducts = products.filter((p) => p.active);
    const withField = field === "price" ? activeProducts : activeProducts.filter((p) => p.cost !== null);
    if (groupBy === "supplier") {
      if (!supplierId) return 0;
      return withField.filter((p) => p.default_supplier_id === supplierId).length;
    }
    if (!brandName) return 0;
    return withField.filter((p) => p.brand === brandName).length;
  }, [products, field, groupBy, supplierId, brandName]);

  function resetAndClose() {
    setGroupBy("supplier");
    setSupplierId("");
    setBrandName("");
    setMode("percent");
    setValue("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (groupBy === "supplier" && !supplierId) {
      setError("Elegí un proveedor.");
      return;
    }
    if (groupBy === "brand" && !brandName) {
      setError("Elegí una marca.");
      return;
    }
    if (affectedCount === 0) {
      setError(
        `Ningún producto activo${field === "cost" ? " con costo cargado" : ""} coincide con esa selección.`
      );
      return;
    }
    setPending(true);
    setError(null);
    const result = await bulkIncreaseField(
      field,
      groupBy === "supplier" ? { supplierId } : { brand: brandName },
      mode,
      Number(value)
    );
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    showSuccess(
      `${fieldLabelCap === "Precio" ? "Precios" : "Costos"} actualizados`,
      `Se actualizaron ${result.updatedCount ?? 0} producto${result.updatedCount === 1 ? "" : "s"}.`
    );
    router.refresh();
    resetAndClose();
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      title={`Aumentar ${fieldLabel}s`}
      description={`Actualiza de una el ${fieldLabel} de todos los productos activos que coincidan con el proveedor o la marca elegidos.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Agrupar por</Label>
          <div className="mt-1.5 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => {
                setGroupBy("supplier");
                setBrandName("");
              }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
                groupBy === "supplier"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Proveedor
            </button>
            <button
              type="button"
              onClick={() => {
                setGroupBy("brand");
                setSupplierId("");
              }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
                groupBy === "brand"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Marca
            </button>
          </div>
        </div>

        {groupBy === "supplier" ? (
          <div>
            <Label htmlFor="bfi-supplier">Proveedor</Label>
            <Select
              id="bfi-supplier"
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
          </div>
        ) : (
          <div>
            <Label htmlFor="bfi-brand">Marca</Label>
            <Select id="bfi-brand" value={brandName} onChange={(e) => setBrandName(e.target.value)}>
              <option value="">Elegí una marca</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {(supplierId || brandName) && (
          <p className="-mt-2 text-xs text-muted-foreground">
            {affectedCount === 0
              ? `Ningún producto activo${field === "cost" ? " con costo cargado" : ""} coincide con esa selección.`
              : `Afecta a ${affectedCount} producto${affectedCount === 1 ? "" : "s"}.`}
          </p>
        )}

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
          <Label htmlFor="bfi-value">
            {mode === "percent" ? "Porcentaje a aumentar" : `Monto a sumar a cada ${fieldLabel}`}
          </Label>
          <Input
            id="bfi-value"
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
          <Button
            type="submit"
            disabled={pending || (groupBy === "supplier" ? !supplierId : !brandName) || !value}
          >
            {pending ? "Actualizando…" : `Aumentar ${fieldLabel}s`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
