"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Package, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast/toast-provider";
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
  const { showSuccess } = useToast();
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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
  const [browseProducts, setBrowseProducts] = useState(false);
  const [browseSuppliers, setBrowseSuppliers] = useState(false);
  const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(-1);
  const lastEnterAt = useRef<number>(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return browseProducts ? localProducts.slice(0, 50) : [];
    return localProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase() === q ||
          p.sku?.toLowerCase() === q
      )
      .slice(0, 50);
  }, [localProducts, query, browseProducts]);

  const selectedSupplier = useMemo(
    () => localSuppliers.find((s) => s.id === supplierId) ?? null,
    [localSuppliers, supplierId]
  );

  const supplierResults = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return browseSuppliers ? localSuppliers.slice(0, 50) : [];
    return localSuppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 50);
  }, [localSuppliers, supplierQuery, browseSuppliers]);

  const total = cart.reduce((acc, line) => acc + line.quantity * line.unitCost, 0);
  const itemCount = cart.reduce((acc, line) => acc + line.quantity, 0);

  function addProduct(product: ProductLite, initialQuantity = 1) {
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + initialQuantity }
            : line
        );
      }
      return [
        ...current,
        { product, quantity: initialQuantity, unitCost: Number(product.cost ?? 0) },
      ];
    });
    setQuery("");
    setBrowseProducts(false);
    setHighlightedIndex(-1);
    searchRef.current?.focus();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (results.length === 0) return;
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1 >= results.length ? 0 : i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      if (results.length === 0) return;
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      return;
    }
    if (e.key !== "Enter") return;
    if (highlightedIndex >= 0 && highlightedIndex < results.length) {
      e.preventDefault();
      addProduct(results[highlightedIndex]);
      return;
    }
    if (results.length === 1) {
      e.preventDefault();
      addProduct(results[0]);
      return;
    }
    if (!query.trim()) {
      registerEnterForConfirm();
    }
  }

  // Doble Enter en cualquier lado (fuera de un campo de texto) registra la
  // compra, igual que en POS. El proveedor es obligatorio: no hay un
  // "proveedor por defecto" como sí existe Consumidor Final para clientes.
  function registerEnterForConfirm() {
    if (cart.length === 0) return;
    // Only ever invoked from a keydown handler, never during render (same
    // pattern as POS's registerEnterForCheckout).
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (now - lastEnterAt.current < 800) {
      lastEnterAt.current = 0;
      if (!supplierId) {
        setError("Elegí un proveedor antes de registrar la compra.");
        return;
      }
      void handleConfirm();
    } else {
      lastEnterAt.current = now;
    }
  }

  function selectSupplier(supplier: SupplierLite) {
    setSupplierId(supplier.id);
    setSupplierQuery("");
    setBrowseSuppliers(false);
    setSupplierHighlightedIndex(-1);
  }

  function handleSupplierSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (supplierResults.length === 0) return;
      e.preventDefault();
      setSupplierHighlightedIndex((i) => (i + 1 >= supplierResults.length ? 0 : i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      if (supplierResults.length === 0) return;
      e.preventDefault();
      setSupplierHighlightedIndex((i) => (i <= 0 ? supplierResults.length - 1 : i - 1));
      return;
    }
    if (e.key !== "Enter") return;
    if (supplierHighlightedIndex >= 0 && supplierHighlightedIndex < supplierResults.length) {
      e.preventDefault();
      selectSupplier(supplierResults[supplierHighlightedIndex]);
    } else if (supplierResults.length === 1) {
      e.preventDefault();
      selectSupplier(supplierResults[0]);
    }
  }

  // Igual que en POS: escribir o pegar desde cualquier lado de la pantalla
  // (o escanear un código de barras) cae directo en el buscador de
  // productos, sin tener que clickearlo primero — salvo que ya se esté
  // escribiendo en otro campo o haya un diálogo abierto.
  useEffect(() => {
    function isTypingInOtherField() {
      const active = document.activeElement;
      if (active === searchRef.current) return false;
      const tag = active?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function handleWindowKeyDown(e: KeyboardEvent) {
      if (showNewProduct || showNewSupplier) return;

      if (e.key === "Enter") {
        if (document.activeElement === searchRef.current) return;
        if (isTypingInOtherField()) return;
        // Si el foco quedó en un botón (ej: el "+" de cantidad recién
        // tocado), el navegador reactiva ese botón con cada Enter además
        // de correr esta lógica — sacamos el foco para evitar que sumar
        // items o clickear "-" pase de nuevo sin querer.
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        registerEnterForConfirm();
        return;
      }

      if (isTypingInOtherField()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return; // only plain printable characters

      if (document.activeElement !== searchRef.current) {
        searchRef.current?.focus();
      }
    }

    function handleWindowPaste(e: ClipboardEvent) {
      if (showNewProduct || showNewSupplier) return;
      if (isTypingInOtherField()) return;

      const text = e.clipboardData?.getData("text");
      if (!text) return;

      e.preventDefault();
      setQuery((prev) => prev + text);
      searchRef.current?.focus();
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
      window.removeEventListener("paste", handleWindowPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNewProduct, showNewSupplier, cart.length, supplierId]);

  function changeQuantity(index: number, delta: number) {
    setCart((current) =>
      current
        .map((line, i) => (i === index ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );
  }

  function updateQuantity(index: number, value: string) {
    const parsed = Number(value);
    setCart((current) =>
      current.map((line, i) =>
        i === index ? { ...line, quantity: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed } : line
      )
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

  function handleProductCreated(
    product: {
      id: string;
      name: string;
      barcode: string | null;
      sku: string | null;
      cost: number | null;
      stock: number;
      unit: string;
    },
    initialStock: number
  ) {
    setLocalProducts((current) => [...current, product]);
    addProduct(product, initialStock > 0 ? initialStock : 1);
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
    if (!supplierId) {
      setError("Elegí un proveedor antes de registrar la compra.");
      return;
    }
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

    showSuccess("¡Compra registrada!", `${formatCurrency(total)} · ${itemCount} unidades`);
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
                <button
                  type="button"
                  onClick={() => {
                    setBrowseProducts((v) => !v);
                    searchRef.current?.focus();
                  }}
                  aria-label="Ver todo el catálogo"
                  title="Ver todo el catálogo"
                  className="absolute left-3.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Search className="h-4 w-4" />
                </button>
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar producto... (↑↓ para elegir, Enter para agregar)"
                  className="pl-10"
                />
                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                    {results.map((product, index) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm",
                          index === highlightedIndex ? "bg-accent" : "hover:bg-muted"
                        )}
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
                <div className="flex flex-wrap items-center gap-3 px-3.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="min-w-0 flex-1">Producto</span>
                  <span className="w-[124px] text-center">Cantidad</span>
                  <span className="w-28">Costo unitario</span>
                  <span className="w-24 text-right">Subtotal</span>
                  <span className="w-7" />
                </div>
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
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateQuantity(index, e.target.value)}
                        className="w-16 px-2 text-center"
                      />
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
            <p className="text-sm text-muted-foreground">Obligatorio: no hay proveedor por defecto.</p>
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
                  <button
                    type="button"
                    onClick={() => setBrowseSuppliers((v) => !v)}
                    aria-label="Ver todos los proveedores"
                    title="Ver todos los proveedores"
                    className="absolute left-3.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <Input
                    value={supplierQuery}
                    onChange={(e) => {
                      setSupplierQuery(e.target.value);
                      setSupplierHighlightedIndex(-1);
                    }}
                    onKeyDown={handleSupplierSearchKeyDown}
                    placeholder="Buscar proveedor… (↑↓ para elegir, Enter selecciona)"
                    className="pl-10"
                  />
                  {supplierResults.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                      {supplierResults.map((supplier, index) => (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => selectSupplier(supplier)}
                          onMouseEnter={() => setSupplierHighlightedIndex(index)}
                          className={cn(
                            "block w-full px-3.5 py-2.5 text-left text-sm",
                            index === supplierHighlightedIndex ? "bg-accent" : "hover:bg-muted"
                          )}
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
              disabled={cart.length === 0 || pending || !supplierId}
              onClick={handleConfirm}
            >
              <Package className="h-4 w-4" />
              {pending ? "Registrando…" : "Registrar Compra (Doble Enter)"}
            </Button>
            {cart.length > 0 && !supplierId && (
              <p className="text-xs text-muted-foreground">
                Elegí un proveedor para poder registrar la compra.
              </p>
            )}
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
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!creatingSupplier) handleCreateSupplier();
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Nombre <span className="font-normal text-muted-foreground">(Enter confirma)</span>
            </label>
            <Input
              autoFocus
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="Nombre del proveedor"
            />
          </div>
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
            <Button type="submit" disabled={creatingSupplier || !newSupplierName.trim()}>
              {creatingSupplier ? "Guardando…" : "Crear y seleccionar (Enter)"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ProductForm
        open={showNewProduct}
        onClose={() => setShowNewProduct(false)}
        onSaved={handleProductCreated}
        initialStockAsPurchase
      />
    </div>
  );
}
