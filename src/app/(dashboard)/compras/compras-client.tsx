"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Package, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import {
  registerPurchase,
  createSupplierQuick,
  type PurchaseItemInput,
} from "@/app/(dashboard)/compras/actions";
import { ProductForm } from "@/app/(dashboard)/productos/product-form";

interface ProductLite {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  cost: number | null;
  stock: number;
  unit: string;
}

interface SupplierLite {
  id: string;
  name: string;
}

interface CartLine {
  product: ProductLite;
  quantity: number;
  unitCost: number;
}

interface ComprasClientProps {
  orgId: string;
  products: ProductLite[];
  suppliers: SupplierLite[];
}

export function ComprasClient({ orgId, products, suppliers }: ComprasClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [localProducts, setLocalProducts] = useState<ProductLite[]>(products);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [localSuppliers, setLocalSuppliers] = useState<SupplierLite[]>(suppliers);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return localProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase() === q ||
          p.sku?.toLowerCase() === q
      )
      .slice(0, 8);
  }, [localProducts, query]);

  const selectedSupplier = useMemo(
    () => localSuppliers.find((s) => s.id === supplierId) ?? null,
    [localSuppliers, supplierId]
  );

  const supplierResults = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return [];
    return localSuppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [localSuppliers, supplierQuery]);

  const total = cart.reduce((acc, line) => acc + line.quantity * line.unitCost, 0);
  const itemCount = cart.reduce((acc, line) => acc + line.quantity, 0);

  function addProduct(product: ProductLite) {
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { product, quantity: 1, unitCost: Number(product.cost ?? 0) }];
    });
    setQuery("");
    searchRef.current?.focus();
  }

  function changeQuantity(index: number, delta: number) {
    setCart((current) =>
      current
        .map((line, i) => (i === index ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );
  }

  function updateUnitCost(index: number, value: string) {
    const parsed = Number(value);
    setCart((current) =>
      current.map((line, i) =>
        i === index ? { ...line, unitCost: Number.isNaN(parsed) ? 0 : parsed } : line
      )
    );
  }

  function removeLine(index: number) {
    setCart((current) => current.filter((_, i) => i !== index));
  }

  function handleProductCreated(product: {
    id: string;
    name: string;
    barcode: string | null;
    sku: string | null;
    cost: number | null;
    stock: number;
    unit: string;
  }) {
    setLocalProducts((current) => [...current, product]);
    addProduct(product);
    setShowNewProduct(false);
  }

  async function handleCreateSupplier() {
    const name = newSupplierName.trim();
    if (!name) {
      setSupplierError("Ingresá un nombre.");
      return;
    }
    setCreatingSupplier(true);
    setSupplierError(null);
    const result = await createSupplierQuick(name);
    setCreatingSupplier(false);
    if (result.error || !result.id) {
      setSupplierError(result.error ?? "No pudimos crear el proveedor.");
      return;
    }
    setLocalSuppliers((current) => [...current, { id: result.id!, name }]);
    setSupplierId(result.id);
    setSupplierQuery("");
    setNewSupplierName("");
    setShowNewSupplier(false);
  }

  async function handleConfirm() {
    if (cart.length === 0 || pending) return;
    setPending(true);
    setError(null);

    const items: PurchaseItemInput[] = cart.map((line) => ({
      product_id: line.product.id,
      quantity: line.quantity,
      unit_cost: line.unitCost,
    }));

    const result = await registerPurchase({
      orgId,
      supplierId: supplierId || null,
      notes,
      items,
    });

    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setCart([]);
    setSupplierId("");
    setSupplierQuery("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buscar producto</CardTitle>
            <p className="text-sm text-muted-foreground">
              Elegí los productos que recibiste del proveedor
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar producto por nombre o código..."
                  className="pl-10"
                />
                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                    {results.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {product.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Stock actual: {product.stock}
                            {product.unit} · Costo: {formatCurrency(Number(product.cost ?? 0))}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewProduct(true)}
                title="Crear producto nuevo"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Producto nuevo</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Productos a ingresar</CardTitle>
            <span className="text-sm text-muted-foreground">Total: {formatCurrency(total)}</span>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Todavía no agregaste productos a esta compra.
              </p>
            ) : (
              <div className="space-y-2">
                {cart.map((line, index) => (
                  <div
                    key={line.product.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {line.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Stock actual: {line.product.stock}
                        {line.product.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => changeQuantity(index, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(index, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="w-28">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unitCost || ""}
                        onChange={(e) => updateUnitCost(index, e.target.value)}
                        placeholder="Costo unit."
                      />
                    </div>

                    <span className="w-24 text-right text-sm font-semibold text-foreground">
                      {formatCurrency(line.quantity * line.unitCost)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-danger hover:bg-danger-bg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proveedor</CardTitle>
            <p className="text-sm text-muted-foreground">Opcional</p>
          </CardHeader>
          <CardContent>
            {selectedSupplier ? (
              <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
                <span className="text-sm font-medium text-foreground">
                  {selectedSupplier.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSupplierId("");
                    setSupplierQuery("");
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={supplierQuery}
                    onChange={(e) => setSupplierQuery(e.target.value)}
                    placeholder="Buscar proveedor…"
                    className="pl-10"
                  />
                  {supplierResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                      {supplierResults.map((supplier) => (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => {
                            setSupplierId(supplier.id);
                            setSupplierQuery("");
                          }}
                          className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-muted"
                        >
                          {supplier.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Cargar proveedor nuevo"
                  onClick={() => {
                    setNewSupplierName(supplierQuery);
                    setSupplierError(null);
                    setShowNewSupplier(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Resumen</CardTitle>
            <Badge tone="accent">{itemCount} unidades</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between border-b border-border pb-3 text-base">
              <span className="font-semibold text-foreground">Total:</span>
              <span className="text-xl font-bold text-foreground">{formatCurrency(total)}</span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Notas (opcional)
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remito, factura, etc."
              />
            </div>

            {error && (
              <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0 || pending}
              onClick={handleConfirm}
            >
              <Package className="h-4 w-4" />
              {pending ? "Registrando…" : "Registrar Compra"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={showNewSupplier}
        onClose={() => {
          setShowNewSupplier(false);
          setSupplierError(null);
        }}
        title="Nuevo proveedor"
        description="Cargá un proveedor rápido para esta compra."
      >
        <div className="space-y-4">
          <Input
            autoFocus
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creatingSupplier) {
                e.preventDefault();
                handleCreateSupplier();
              }
            }}
            placeholder="Nombre del proveedor"
          />
          {supplierError && (
            <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              {supplierError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowNewSupplier(false);
                setSupplierError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={creatingSupplier || !newSupplierName.trim()}
              onClick={handleCreateSupplier}
            >
              {creatingSupplier ? "Guardando…" : "Crear y seleccionar"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ProductForm
        open={showNewProduct}
        onClose={() => setShowNewProduct(false)}
        onSaved={handleProductCreated}
      />
    </div>
  );
}
