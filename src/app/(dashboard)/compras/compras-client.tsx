"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  ImageIcon,
  Landmark,
  Minus,
  Package,
  Plus,
  QrCode,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
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
  type PurchasePaymentInput,
  type PurchasePaymentMethod,
} from "@/app/(dashboard)/compras/actions";
import { ProductForm } from "@/app/(dashboard)/productos/product-form";

interface ProductLite {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  cost: number | null;
  stock: number;
  min_stock: number;
  unit: string;
  image_url: string | null;
}

interface SupplierLite {
  id: string;
  name: string;
  balance: number;
}

interface CartLine {
  product: ProductLite;
  quantity: number;
  unitCost: number;
}

function paymentMethodOptionsWithCustom(customMethods: string[]): {
  value: PurchasePaymentMethod;
  label: string;
  icon: typeof Banknote;
}[] {
  return [
    { value: "efectivo", label: "Efectivo", icon: Banknote },
    { value: "tarjeta", label: "Tarjeta", icon: CreditCard },
    { value: "transferencia", label: "Transferencia", icon: Landmark },
    { value: "qr", label: "QR", icon: QrCode },
    ...customMethods.map((name) => ({ value: name, label: name, icon: CircleDollarSign })),
    { value: "cuenta_corriente", label: "Cuenta corriente", icon: Wallet },
  ];
}

interface ComprasClientProps {
  orgId: string;
  products: ProductLite[];
  suppliers: SupplierLite[];
  hasOpenCaja: boolean;
  customPaymentMethods: string[];
}

export function ComprasClient({
  orgId,
  products,
  suppliers,
  hasOpenCaja,
  customPaymentMethods,
}: ComprasClientProps) {
  const paymentMethodOptions = useMemo(
    () => paymentMethodOptionsWithCustom(customPaymentMethods),
    [customPaymentMethods]
  );
  const router = useRouter();
  const { showSuccess } = useToast();
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [cart, setCart] = useState<CartLine[]>([]);
  // Productos/proveedores creados al vuelo (alta rápida) que todavía no
  // llegaron en los props del servidor. Derivar así (en vez de copiar
  // `products`/`suppliers` a un useState y sincronizarlo en un efecto)
  // evita que un stock o saldo de cuenta corriente que cambia en el
  // servidor (otra compra en esta misma pantalla) quede pisado por una
  // copia vieja: como los props se usan directo acá, un `router.refresh()`
  // ya alcanza para verlos actualizados sin salir y volver a entrar a /compras.
  const [extraProducts, setExtraProducts] = useState<ProductLite[]>([]);
  const localProducts = useMemo(() => {
    const existingIds = new Set(products.map((p) => p.id));
    return [...products, ...extraProducts.filter((p) => !existingIds.has(p.id))];
  }, [products, extraProducts]);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductKey, setNewProductKey] = useState(0);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [extraSuppliers, setExtraSuppliers] = useState<SupplierLite[]>([]);
  const localSuppliers = useMemo(() => {
    const existingIds = new Set(suppliers.map((s) => s.id));
    return [...suppliers, ...extraSuppliers.filter((s) => !existingIds.has(s.id))];
  }, [suppliers, extraSuppliers]);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [splitPayment, setSplitPayment] = useState(false);
  const [singleMethod, setSingleMethod] = useState<PurchasePaymentMethod | null>(null);
  const [mixedAmounts, setMixedAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {
      efectivo: "",
      tarjeta: "",
      transferencia: "",
      qr: "",
      cuenta_corriente: "",
    };
    for (const name of customPaymentMethods) initial[name] = "";
    return initial;
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browseProducts, setBrowseProducts] = useState(false);
  const [browseSuppliers, setBrowseSuppliers] = useState(false);
  const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(-1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
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

  const mixedEntries: PurchasePaymentInput[] = Object.entries(mixedAmounts)
    .map(([method, raw]) => ({ method, amount: Number(raw) || 0 }))
    .filter((p) => p.amount > 0);
  const mixedTotalAssigned = mixedEntries.reduce((acc, p) => acc + p.amount, 0);
  const mixedRemaining = total - mixedTotalAssigned;

  const payments: PurchasePaymentInput[] = splitPayment
    ? mixedEntries
    : singleMethod
      ? [{ method: singleMethod, amount: total }]
      : [];
  const accountAmount = payments.find((p) => p.method === "cuenta_corriente")?.amount ?? 0;
  const paidNow = total - accountAmount;
  const paymentsValid = splitPayment
    ? mixedEntries.length > 0 && Math.abs(mixedRemaining) < 0.01
    : Boolean(singleMethod);

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

  // Los inputs de "cuánto se paga con cada medio" no pasan por el listener
  // global de doble Enter (ese ignora cualquier campo de texto enfocado
  // para no interceptar Enter mientras se está escribiendo un número), así
  // que necesitan este handler propio para que el doble Enter también
  // registre la compra sin tener que sacar el foco del campo primero.
  function handlePaymentAmountKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.currentTarget.blur();
    registerEnterForConfirm();
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
  }, [showNewProduct, showNewSupplier, cart.length, supplierId, singleMethod, splitPayment, mixedAmounts]);

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

  function resetPayment() {
    setSplitPayment(false);
    setSingleMethod(null);
    setMixedAmounts({ efectivo: "", tarjeta: "", transferencia: "", qr: "", cuenta_corriente: "" });
  }

  function handleProductCreated(
    product: {
      id: string;
      name: string;
      barcode: string | null;
      sku: string | null;
      cost: number | null;
      stock: number;
      min_stock: number;
      unit: string;
      image_url: string | null;
    },
    initialStock: number
  ) {
    setExtraProducts((current) => [...current, product]);
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
    setExtraSuppliers((current) => [...current, { id: result.id!, name, balance: 0 }]);
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
    if (!paymentsValid) {
      setError(
        splitPayment
          ? "Asigná cada medio hasta cubrir el total de la compra."
          : "Elegí cómo se paga esta compra."
      );
      return;
    }
    const hasCash = payments.some((p) => p.method === "efectivo" && p.amount > 0);
    if (hasCash && !hasOpenCaja) {
      setError("Abrí tu caja para poder pagar en efectivo.");
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
      payments,
    });

    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showSuccess(
      "¡Compra registrada!",
      accountAmount > 0
        ? `${formatCurrency(total)} · ${formatCurrency(accountAmount)} a cuenta corriente`
        : `${formatCurrency(total)} · ${itemCount} unidades`
    );
    setCart([]);
    setSupplierId("");
    setSupplierQuery("");
    setNotes("");
    resetPayment();
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
                  placeholder="Buscar producto o escanear código... (↑↓ para elegir, Enter para agregar)"
                  className="pl-10"
                />
                {(query.trim() || browseProducts) && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                    {results.length === 0 && (
                      <p className="px-3.5 py-3 text-sm text-muted-foreground">
                        {query.trim()
                          ? `No encontramos productos que coincidan con "${query}".`
                          : "Todavía no cargaste productos."}
                      </p>
                    )}
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
                            Stock actual:{" "}
                            <span
                              className={cn(
                                "font-medium",
                                product.stock <= product.min_stock
                                  ? "text-danger"
                                  : "text-muted-foreground"
                              )}
                            >
                              {product.stock}
                              {product.unit}
                            </span>{" "}
                            · Costo: {formatCurrency(Number(product.cost ?? 0))}
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
                onClick={() => {
                  setNewProductKey((k) => k + 1);
                  setShowNewProduct(true);
                }}
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
                <div className="flex items-center justify-between gap-3 px-3.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Producto</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="w-[156px] text-center">Cantidad</span>
                    <span className="w-28 text-center">Costo unitario</span>
                    <span className="w-24 text-right">Subtotal</span>
                    <span className="w-7" />
                  </div>
                </div>
                {cart.map((line, index) => (
                  <div
                    key={line.product.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          line.product.image_url && setPreviewImage(line.product.image_url)
                        }
                        disabled={!line.product.image_url}
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-muted-foreground"
                      >
                        {line.product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={line.product.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {line.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stock actual:{" "}
                          <span
                            className={cn(
                              "font-medium",
                              line.product.stock <= line.product.min_stock
                                ? "text-danger"
                                : "text-muted-foreground"
                            )}
                          >
                            {line.product.stock}
                            {line.product.unit}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex w-[156px] items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => changeQuantity(index, -1)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => updateQuantity(index, e.target.value)}
                          className="w-20 px-1.5 text-center"
                        />
                        <button
                          type="button"
                          onClick={() => changeQuantity(index, 1)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
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
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-bg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
                  {selectedSupplier.balance > 0 && (
                    <span className="ml-1.5 font-normal text-warning">
                      (le debés {formatCurrency(selectedSupplier.balance)})
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSupplierId("");
                    setSupplierQuery("");
                    resetPayment();
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
                    onFocus={() => setBrowseSuppliers(true)}
                    placeholder="Buscar proveedor… (↑↓ para elegir, Enter selecciona)"
                    className="pl-10"
                  />
                  {(supplierQuery.trim() || browseSuppliers) && (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                      {supplierResults.length === 0 && (
                        <p className="px-3.5 py-2.5 text-sm text-muted-foreground">
                          {supplierQuery.trim()
                            ? `No encontramos proveedores que coincidan con "${supplierQuery}".`
                            : "Todavía no cargaste proveedores."}
                        </p>
                      )}
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
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  ¿Cómo se paga esta compra?
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSplitPayment((v) => !v);
                    setSingleMethod(null);
                    setMixedAmounts({
                      efectivo: "",
                      tarjeta: "",
                      transferencia: "",
                      qr: "",
                      cuenta_corriente: "",
                    });
                    setError(null);
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {splitPayment ? "Usar un solo medio" : "Dividir en varios medios"}
                </button>
              </div>

              {splitPayment ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Asigná cuánto se paga con cada medio hasta cubrir el total.
                  </p>
                  {paymentMethodOptions.map((m) => {
                    const disabled = m.value === "efectivo" && !hasOpenCaja;
                    return (
                      <div key={m.value} className="flex items-center gap-2">
                        <m.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="w-28 shrink-0 text-sm text-foreground">{m.label}</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={disabled}
                          title={disabled ? "Abrí tu caja para pagar en efectivo" : undefined}
                          value={mixedAmounts[m.value]}
                          onChange={(e) => {
                            setMixedAmounts((current) => ({
                              ...current,
                              [m.value]: e.target.value,
                            }));
                            setError(null);
                          }}
                          onKeyDown={handlePaymentAmountKeyDown}
                          placeholder="0.00"
                        />
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
                    <span className="text-muted-foreground">Asignado / Total</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(mixedTotalAssigned)} / {formatCurrency(total)}
                    </span>
                  </div>
                  {Math.abs(mixedRemaining) > 0.01 && (
                    <p
                      className={cn(
                        "text-xs font-medium",
                        mixedRemaining > 0 ? "text-danger" : "text-warning"
                      )}
                    >
                      {mixedRemaining > 0
                        ? `Falta asignar ${formatCurrency(mixedRemaining)}`
                        : `Te pasaste por ${formatCurrency(-mixedRemaining)}`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {paymentMethodOptions.map((m) => {
                    const disabled = m.value === "efectivo" && !hasOpenCaja;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        disabled={disabled}
                        title={disabled ? "Abrí tu caja para pagar en efectivo" : undefined}
                        onClick={() => {
                          setSingleMethod(m.value);
                          setError(null);
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5 text-center text-[11px] font-medium transition-colors",
                          disabled
                            ? "cursor-not-allowed border-border text-muted-foreground/50"
                            : singleMethod === m.value
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-border text-foreground hover:bg-muted"
                        )}
                      >
                        <m.icon className="h-4 w-4" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {!hasOpenCaja && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Abrí tu caja para poder pagar en efectivo.
                </p>
              )}

              {accountAmount > 0 && (
                <div className="mt-2 space-y-1.5 rounded-xl bg-muted/50 px-3.5 py-3">
                  {paidNow > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pagás ahora</span>
                      <span className="text-base font-semibold text-foreground">
                        {formatCurrency(paidNow)}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex items-center justify-between",
                      paidNow > 0 && "border-t border-border pt-1.5"
                    )}
                  >
                    <span className="text-sm text-muted-foreground">Queda a cuenta corriente</span>
                    <span className="text-base font-semibold text-warning">
                      {formatCurrency(accountAmount)}
                    </span>
                  </div>
                </div>
              )}
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
              disabled={cart.length === 0 || pending || !supplierId || !paymentsValid}
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
        key={`new-${newProductKey}`}
        open={showNewProduct}
        onClose={() => setShowNewProduct(false)}
        onSaved={handleProductCreated}
        suppliers={localSuppliers}
        onSupplierCreated={(supplier) =>
          setExtraSuppliers((current) => [...current, { ...supplier, balance: 0 }])
        }
        initialStockAsPurchase
      />

      <Dialog
        open={previewImage !== null}
        onClose={() => setPreviewImage(null)}
        title="Imagen del producto"
      >
        {previewImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewImage}
            alt=""
            className="mx-auto max-h-[60vh] w-full rounded-xl object-contain"
          />
        )}
      </Dialog>
    </div>
  );
}
