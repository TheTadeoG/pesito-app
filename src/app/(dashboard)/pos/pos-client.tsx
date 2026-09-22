"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CreditCard,
  ImageIcon,
  Landmark,
  Minus,
  Plus,
  Percent,
  QrCode,
  Scale,
  Search,
  Shuffle,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { resolveInvoiceType } from "@/lib/invoice-labels";
import { suggestBilletes } from "@/lib/billetes";
import {
  checkoutSale,
  createCustomerQuick,
  type CheckoutItemInput,
  type PaymentLineInput,
} from "@/app/(dashboard)/pos/actions";

interface ProductLite {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  price: number;
  stock: number;
  unit: string;
  image_url: string | null;
}

interface CustomerLite {
  id: string;
  name: string;
  invoice_type: string | null;
  balance: number;
}

type CartItem =
  | { kind: "product"; product: ProductLite; quantity: number }
  | { kind: "manual"; id: string; label: string; amount: number };

type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "qr" | "mixto" | "fiado";

const paymentMethods: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "efectivo", label: "Efectivo", icon: Banknote },
  { value: "tarjeta", label: "Tarjeta", icon: CreditCard },
  { value: "transferencia", label: "Transferencia", icon: Landmark },
  { value: "qr", label: "QR", icon: QrCode },
  { value: "mixto", label: "Mixto", icon: Shuffle },
  { value: "fiado", label: "Fiado", icon: Wallet },
];

type CombinableMethod = "efectivo" | "tarjeta" | "transferencia" | "qr" | "fiado";

const combinableMethods: { value: CombinableMethod; label: string; icon: typeof Banknote }[] = [
  { value: "efectivo", label: "Efectivo", icon: Banknote },
  { value: "tarjeta", label: "Tarjeta", icon: CreditCard },
  { value: "transferencia", label: "Transferencia", icon: Landmark },
  { value: "qr", label: "QR", icon: QrCode },
  { value: "fiado", label: "Fiado", icon: Wallet },
];

function paymentMethodForLines(lines: PaymentLineInput[]): PaymentMethod {
  const nonZero = lines.filter((l) => l.amount > 0);
  if (nonZero.length === 1) return nonZero[0].method;
  return "mixto";
}

interface PosClientProps {
  orgId: string;
  cashRegisterId: string;
  products: ProductLite[];
  customers: CustomerLite[];
  autoInvoiceByPayment: boolean;
}

export function PosClient({
  orgId,
  cashRegisterId,
  products,
  customers,
  autoInvoiceByPayment,
}: PosClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<CustomerLite[]>(customers);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountInput, setDiscountInput] = useState("");
  const [surchargeMode, setSurchargeMode] = useState<"amount" | "percent">("amount");
  const [surchargeInput, setSurchargeInput] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [showManualAmount, setShowManualAmount] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showCashStep, setShowCashStep] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [showMixedStep, setShowMixedStep] = useState(false);
  const [mixedAmounts, setMixedAmounts] = useState<Record<CombinableMethod, string>>({
    efectivo: "",
    tarjeta: "",
    transferencia: "",
    qr: "",
    fiado: "",
  });
  const [manualLabel, setManualLabel] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browseProducts, setBrowseProducts] = useState(false);
  const [browseCustomers, setBrowseCustomers] = useState(false);
  const [customerHighlightedIndex, setCustomerHighlightedIndex] = useState(-1);
  const lastEnterAt = useRef<number>(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return browseProducts ? products.slice(0, 50) : [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase() === q ||
          p.sku?.toLowerCase() === q
      )
      .slice(0, 50);
  }, [products, query, browseProducts]);

  const selectedCustomer = useMemo(
    () => localCustomers.find((c) => c.id === customerId) ?? null,
    [localCustomers, customerId]
  );

  const customerResults = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return browseCustomers ? localCustomers.slice(0, 50) : [];
    return localCustomers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50);
  }, [localCustomers, customerQuery, browseCustomers]);

  const subtotal = cart.reduce((acc, item) => {
    if (item.kind === "product") return acc + item.product.price * item.quantity;
    return acc + item.amount;
  }, 0);
  const discount =
    discountMode === "percent"
      ? (subtotal * (Number(discountInput) || 0)) / 100
      : Number(discountInput) || 0;
  const surcharge =
    surchargeMode === "percent"
      ? (subtotal * (Number(surchargeInput) || 0)) / 100
      : Number(surchargeInput) || 0;
  const total = Math.max(0, subtotal - discount + surcharge);
  const itemCount = cart.reduce(
    (acc, item) => acc + (item.kind === "product" ? item.quantity : 1),
    0
  );

  const mixedEntries: PaymentLineInput[] = (
    Object.entries(mixedAmounts) as [CombinableMethod, string][]
  )
    .map(([method, raw]) => ({ method, amount: Number(raw) || 0 }))
    .filter((p) => p.amount > 0);
  const mixedTotalAssigned = mixedEntries.reduce((acc, p) => acc + p.amount, 0);
  const mixedRemaining = total - mixedTotalAssigned;
  const mixedFiadoAmount = Number(mixedAmounts.fiado) || 0;

  function addProduct(product: ProductLite) {
    setError(null);
    setCart((current) => {
      const existing = current.find(
        (item) => item.kind === "product" && item.product.id === product.id
      );
      if (existing) {
        return current.map((item) =>
          item.kind === "product" && item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, { kind: "product", product, quantity: 1 }];
    });
    setQuery("");
    setBrowseProducts(false);
    setHighlightedIndex(-1);
  }

  function changeQuantity(index: number, delta: number) {
    setCart((current) =>
      current
        .map((item, i) => {
          if (i !== index || item.kind !== "product") return item;
          return { ...item, quantity: item.quantity + delta };
        })
        .filter((item) => item.kind !== "product" || item.quantity > 0)
    );
  }

  function removeItem(index: number) {
    setCart((current) => current.filter((_, i) => i !== index));
  }

  function addManualAmount() {
    const amount = Number(manualAmount.replace(",", "."));
    if (!amount || amount <= 0) return;
    setCart((current) => [
      ...current,
      {
        kind: "manual",
        id: crypto.randomUUID(),
        label: manualLabel.trim() || "Monto libre",
        amount,
      },
    ]);
    setManualLabel("");
    setManualAmount("");
    setShowManualAmount(false);
  }

  function openPaymentPicker() {
    if (cart.length === 0 || pending) return;
    setError(null);
    setShowCashStep(false);
    setCashReceived("");
    setShowMixedStep(false);
    setMixedAmounts({ efectivo: "", tarjeta: "", transferencia: "", qr: "", fiado: "" });
    setShowPaymentPicker(true);
  }

  function closePaymentPicker() {
    setShowPaymentPicker(false);
    setShowCashStep(false);
    setCashReceived("");
    setShowMixedStep(false);
  }

  function pickMethod(method: PaymentMethod) {
    if (method === "efectivo") {
      setShowCashStep(true);
      return;
    }
    if (method === "mixto") {
      setShowMixedStep(true);
      return;
    }
    void processSale(method);
  }

  async function handleCreateCustomer() {
    const name = newCustomerName.trim();
    if (!name) {
      setCustomerError("Ingresá un nombre.");
      return;
    }
    setCreatingCustomer(true);
    setCustomerError(null);
    const result = await createCustomerQuick(name);
    setCreatingCustomer(false);
    if (result.error || !result.id) {
      setCustomerError(result.error ?? "No pudimos crear el cliente.");
      return;
    }
    setLocalCustomers((current) => [
      ...current,
      { id: result.id!, name, invoice_type: null, balance: 0 },
    ]);
    setCustomerId(result.id);
    setCustomerQuery("");
    setNewCustomerName("");
    setShowNewCustomer(false);
  }

  function selectCustomer(customer: CustomerLite) {
    setCustomerId(customer.id);
    setCustomerQuery("");
    setBrowseCustomers(false);
    setShowCustomerSearch(false);
    setCustomerHighlightedIndex(-1);
  }

  function handleCustomerSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (customerResults.length === 0) return;
      e.preventDefault();
      setCustomerHighlightedIndex((i) => (i + 1 >= customerResults.length ? 0 : i + 1));
      return;
    }

    if (e.key === "ArrowUp") {
      if (customerResults.length === 0) return;
      e.preventDefault();
      setCustomerHighlightedIndex((i) => (i <= 0 ? customerResults.length - 1 : i - 1));
      return;
    }

    if (e.key !== "Enter") return;

    if (customerHighlightedIndex >= 0 && customerHighlightedIndex < customerResults.length) {
      e.preventDefault();
      selectCustomer(customerResults[customerHighlightedIndex]);
      return;
    }
    if (customerResults.length === 1) {
      e.preventDefault();
      selectCustomer(customerResults[0]);
    }
  }

  // Selector de cliente compacto, reusado dentro de los diálogos de pago
  // (combinar medios de pago, o cargar a fiado la diferencia de un pago en
  // efectivo que no alcanza) para elegir/ver el cliente sin salir del paso.
  function renderInlineCustomerPicker() {
    if (selectedCustomer) {
      return (
        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {selectedCustomer.name}
            {selectedCustomer.balance > 0 && (
              <span className="ml-1.5 text-xs font-normal text-danger">
                (debe {formatCurrency(selectedCustomer.balance)})
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              setCustomerId("");
              setCustomerQuery("");
            }}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cambiar
          </button>
        </div>
      );
    }

    return (
      <div className="relative">
        <Input
          value={customerQuery}
          onChange={(e) => {
            setCustomerQuery(e.target.value);
            setCustomerHighlightedIndex(-1);
          }}
          onKeyDown={handleCustomerSearchKeyDown}
          placeholder="Buscar cliente… (↑↓ para elegir, Enter selecciona)"
        />
        {customerResults.length > 0 && (
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
            {customerResults.map((customer, index) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => selectCustomer(customer)}
                onMouseEnter={() => setCustomerHighlightedIndex(index)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm",
                  index === customerHighlightedIndex ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <span className="truncate">{customer.name}</span>
                {customer.balance > 0 && (
                  <span className="shrink-0 text-xs text-danger">
                    debe {formatCurrency(customer.balance)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Triggered by a real Enter keypress anywhere on the page (not while
  // typing in a field): two presses within 800ms open the payment picker,
  // so a cashier can check out without touching the mouse.
  function registerEnterForCheckout() {
    if (cart.length === 0) return;
    const now = Date.now();
    if (now - lastEnterAt.current < 800) {
      lastEnterAt.current = 0;
      openPaymentPicker();
    } else {
      lastEnterAt.current = now;
    }
  }

  // A cashier (or a barcode scanner, which just types fast) should be able
  // to start typing/scanning or paste from anywhere on the page and have it
  // land in the search box, without clicking into it first — as long as
  // they're not already typing into some other field (discount, manual
  // amount, customer select, etc.) or a dialog is open.
  useEffect(() => {
    function isTypingInOtherField() {
      const active = document.activeElement;
      if (active === searchRef.current) return false;
      const tag = active?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function handleWindowKeyDown(e: KeyboardEvent) {
      if (showPaymentPicker) return;

      if (e.key === "Enter") {
        if (document.activeElement === searchRef.current) return;
        if (isTypingInOtherField()) return;
        registerEnterForCheckout();
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
      if (showPaymentPicker) return;
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
  }, [cart.length, showPaymentPicker]);

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
    e.preventDefault();

    if (query.trim()) {
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        addProduct(results[highlightedIndex]);
        return;
      }
      const exactBarcode = products.find(
        (p) => p.barcode && p.barcode.toLowerCase() === query.trim().toLowerCase()
      );
      if (exactBarcode) {
        addProduct(exactBarcode);
        return;
      }
      if (results.length === 1) {
        addProduct(results[0]);
      }
      return;
    }

    registerEnterForCheckout();
  }

  async function processSale(method: PaymentMethod, payments?: PaymentLineInput[]) {
    const fiadoAmount = payments
      ? payments.find((p) => p.method === "fiado")?.amount ?? 0
      : method === "fiado"
        ? total
        : 0;

    if (fiadoAmount > 0 && !customerId) {
      closePaymentPicker();
      setError("Para cargar fiado primero elegí un cliente.");
      return;
    }

    closePaymentPicker();
    setPending(true);
    setError(null);

    const items: CheckoutItemInput[] = cart.map((item) =>
      item.kind === "product"
        ? {
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
          }
        : {
            product_id: null,
            product_name: item.label,
            quantity: 1,
            unit_price: item.amount,
          }
    );

    const result = await checkoutSale({
      orgId,
      cashRegisterId,
      customerId: customerId || null,
      paymentMethod: method,
      discount,
      surcharge,
      invoiceType: resolveInvoiceType(selectedCustomer?.invoice_type, method, autoInvoiceByPayment),
      items,
      payments,
    });

    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setCart([]);
    setDiscountInput("");
    setSurchargeInput("");
    setCustomerId("");
    setCustomerQuery("");
    setShowCustomerSearch(false);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buscar Producto</CardTitle>
            <p className="text-sm text-muted-foreground">
              Escaneá código de barras o escriba el nombre del producto
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row">
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
                  className={query ? "pl-10 pr-9" : "pl-10"}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    aria-label="Borrar búsqueda"
                    className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                    {results.map((product, index) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm",
                          index === highlightedIndex ? "bg-accent" : "hover:bg-muted"
                        )}
                      >
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            if (!product.image_url) return;
                            e.stopPropagation();
                            setPreviewImage(product.image_url);
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-muted-foreground"
                        >
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {product.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(product.price)}
                          </span>
                        </span>
                        {product.stock <= 5 && (
                          <Badge tone="danger">Stock {product.stock}</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => searchRef.current?.focus()}
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Consultar Precio</span>
                </Button>
                <Button type="button" variant="outline" disabled title="Próximamente">
                  <Scale className="h-4 w-4" />
                  <span className="hidden sm:inline">Balanza</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowManualAmount((v) => !v)}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Agregar Monto</span>
                </Button>
              </div>
            </div>

            {showManualAmount && (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-muted/50 p-3 sm:flex-row">
                <Input
                  placeholder="Descripción (opcional)"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  className="sm:flex-1"
                />
                <Input
                  placeholder="Monto"
                  inputMode="decimal"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="sm:w-32"
                />
                <Button type="button" onClick={addManualAmount}>
                  Agregar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Carrito</CardTitle>
            <span className="text-sm text-muted-foreground">Total: {formatCurrency(total)}</span>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Todavía no agregaste productos.
              </p>
            ) : (
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div
                    key={item.kind === "product" ? item.product.id : item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {item.kind === "product" && (
                        <button
                          type="button"
                          onClick={() => item.product.image_url && setPreviewImage(item.product.image_url)}
                          disabled={!item.product.image_url}
                          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-muted-foreground"
                        >
                          {item.product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.kind === "product" ? item.product.name : item.label}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(
                              item.kind === "product" ? item.product.price : item.amount
                            )}
                          </span>
                          {item.kind === "product" && item.product.stock <= 5 && (
                            <Badge tone="danger" className="px-1.5 py-0 text-[10px]">
                              Stock: {item.product.stock}{item.product.unit}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="w-20 text-right text-sm font-semibold text-foreground">
                        {formatCurrency(
                          item.kind === "product"
                            ? item.product.price * item.quantity
                            : item.amount
                        )}
                      </span>

                      {item.kind === "product" ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => changeQuantity(index, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(index, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="w-5" />
                      )}

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-danger hover:bg-danger-bg"
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
            <CardTitle className="text-base">Cliente</CardTitle>
            <p className="text-sm text-muted-foreground">Selecciona el cliente para la venta</p>
          </CardHeader>
          <CardContent>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
                <span className="text-sm font-medium text-foreground">
                  {selectedCustomer.name}
                  {selectedCustomer.balance > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-danger">
                      (debe {formatCurrency(selectedCustomer.balance)})
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId("");
                    setCustomerQuery("");
                    setShowCustomerSearch(false);
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cambiar
                </button>
              </div>
            ) : !showCustomerSearch ? (
              <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
                <span className="text-sm font-medium text-foreground">Consumidor Final</span>
                <button
                  type="button"
                  onClick={() => setShowCustomerSearch(true)}
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
                    onClick={() => setBrowseCustomers((v) => !v)}
                    aria-label="Ver todos los clientes"
                    title="Ver todos los clientes"
                    className="absolute left-3.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <Input
                    autoFocus
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setCustomerHighlightedIndex(-1);
                    }}
                    onKeyDown={handleCustomerSearchKeyDown}
                    placeholder="Buscar cliente… (↑↓ para elegir, Enter selecciona)"
                    className="pl-10"
                  />
                  {customerResults.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                      {customerResults.map((customer, index) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          onMouseEnter={() => setCustomerHighlightedIndex(index)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm",
                            index === customerHighlightedIndex ? "bg-accent" : "hover:bg-muted"
                          )}
                        >
                          <span className="truncate">{customer.name}</span>
                          {customer.balance > 0 && (
                            <span className="shrink-0 text-xs text-danger">
                              debe {formatCurrency(customer.balance)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Cargar cliente nuevo"
                  onClick={() => {
                    setNewCustomerName(customerQuery);
                    setCustomerError(null);
                    setShowNewCustomer(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerQuery("");
                    setBrowseCustomers(false);
                    setShowCustomerSearch(false);
                  }}
                  className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Resumen</CardTitle>
            <Badge tone="accent">{itemCount} items</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Descuento{discountMode === "percent" ? ` (${discountInput}%)` : ""}:
                </span>
                <span className="font-medium text-danger">-{formatCurrency(discount)}</span>
              </div>
            )}
            {surcharge > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Recargo{surchargeMode === "percent" ? ` (${surchargeInput}%)` : ""}:
                </span>
                <span className="font-medium text-warning">+{formatCurrency(surcharge)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <span className="font-semibold text-foreground">Total:</span>
              <span className="text-xl font-bold text-foreground">{formatCurrency(total)}</span>
            </div>

            {error && (
              <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0 || pending}
              onClick={openPaymentPicker}
            >
              <Banknote className="h-4 w-4" />
              {pending ? "Procesando…" : "Procesar Venta (Doble Enter)"}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={() => setShowExtras((v) => !v)}
            >
              <Percent className="h-4 w-4" />
              Agregar descuento o recargo
            </Button>

            {showExtras && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Doble Enter en estos campos también confirma la venta.
                </p>
                <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5 rounded-xl border border-danger/30 bg-danger-bg/60 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-danger">Descuento</label>
                    <div className="flex overflow-hidden rounded-md border border-danger/40">
                      {(["amount", "percent"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setDiscountMode(mode)}
                          className={cn(
                            "px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                            discountMode === mode
                              ? "bg-danger text-white"
                              : "text-danger hover:bg-danger/10"
                          )}
                        >
                          {mode === "amount" ? "$" : "%"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={discountMode === "percent" ? 100 : undefined}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      registerEnterForCheckout();
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5 rounded-xl border border-warning/30 bg-warning-bg/60 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-warning">Recargo</label>
                    <div className="flex overflow-hidden rounded-md border border-warning/40">
                      {(["amount", "percent"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSurchargeMode(mode)}
                          className={cn(
                            "px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                            surchargeMode === mode
                              ? "bg-warning text-white"
                              : "text-warning hover:bg-warning/10"
                          )}
                        >
                          {mode === "amount" ? "$" : "%"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={surchargeMode === "percent" ? 100 : undefined}
                    value={surchargeInput}
                    onChange={(e) => setSurchargeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      registerEnterForCheckout();
                    }}
                    placeholder="0"
                  />
                </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={showPaymentPicker}
        onClose={closePaymentPicker}
        title={
          showCashStep
            ? "Pago en efectivo"
            : showMixedStep
              ? "Combinar medios de pago"
              : "¿Cómo paga?"
        }
        description={`Total a cobrar: ${formatCurrency(total)}`}
      >
        {showMixedStep ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              if (mixedEntries.length === 0 || Math.abs(mixedRemaining) > 0.01) return;
              if (mixedFiadoAmount > 0 && !customerId) return;
              void processSale(paymentMethodForLines(mixedEntries), mixedEntries);
            }}
          >
            <p className="text-xs text-muted-foreground">
              Asigná cuánto paga con cada medio hasta cubrir el total.
            </p>

            <div className="space-y-2">
              {combinableMethods.map((m) => (
                <div key={m.value} className="flex items-center gap-2">
                  <m.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="w-28 shrink-0 text-sm text-foreground">{m.label}</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={mixedAmounts[m.value]}
                    onChange={(e) =>
                      setMixedAmounts((current) => ({ ...current, [m.value]: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>

            {mixedFiadoAmount > 0 && (
              <div className="space-y-1.5 rounded-xl border border-border p-3">
                <p className="text-xs font-medium text-foreground">Cliente para la parte fiado</p>
                {renderInlineCustomerPicker()}
              </div>
            )}

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

            {error && (
              <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowMixedStep(false)}>
                Atrás
              </Button>
              <Button
                type="submit"
                disabled={
                  pending ||
                  mixedEntries.length === 0 ||
                  Math.abs(mixedRemaining) > 0.01 ||
                  (mixedFiadoAmount > 0 && !customerId)
                }
              >
                {pending ? "Procesando…" : "Confirmar venta (Enter)"}
              </Button>
            </div>
          </form>
        ) : showCashStep ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              // Campo vacío = paga justo (el placeholder ya muestra el total).
              const received = cashReceived === "" ? total : Number(cashReceived);
              if (received >= total) {
                void processSale("efectivo");
              }
            }}
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                ¿Con cuánto paga? <span className="font-normal text-muted-foreground">(Enter confirma)</span>
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                autoFocus
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder={String(total)}
              />
            </div>

            {cashReceived !== "" &&
              (Number(cashReceived) >= total ? (
                <div className="space-y-2 rounded-xl bg-success-bg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-success">Vuelto</span>
                    <span className="text-lg font-bold text-success">
                      {formatCurrency(Number(cashReceived) - total)}
                    </span>
                  </div>
                  {Number(cashReceived) - total > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-success/20 pt-2">
                      {suggestBilletes(Number(cashReceived) - total).map((b) => (
                        <span
                          key={b.value}
                          className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-success"
                        >
                          {b.count} x {formatCurrency(b.value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-danger-bg px-4 py-3">
                    <span className="text-sm font-medium text-danger">Falta</span>
                    <span className="text-lg font-bold text-danger">
                      {formatCurrency(total - Number(cashReceived))}
                    </span>
                  </div>

                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <p className="text-xs font-medium text-foreground">
                      ¿Cargar la diferencia ({formatCurrency(total - Number(cashReceived))}) a la
                      cuenta de un cliente (fiado)?
                    </p>
                    {renderInlineCustomerPicker()}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!customerId || pending}
                      onClick={() => {
                        const efectivoAmount = Number(cashReceived) || 0;
                        const fiadoAmount = total - efectivoAmount;
                        const allLines: PaymentLineInput[] = [
                          { method: "efectivo", amount: efectivoAmount },
                          { method: "fiado", amount: fiadoAmount },
                        ];
                        const lines = allLines.filter((p) => p.amount > 0);
                        void processSale(paymentMethodForLines(lines), lines);
                      }}
                    >
                      Cargar diferencia a fiado y confirmar venta
                    </Button>
                  </div>
                </div>
              ))}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCashStep(false);
                  setCashReceived("");
                }}
              >
                Atrás
              </Button>
              <Button
                type="submit"
                disabled={pending || (cashReceived !== "" && Number(cashReceived) < total)}
              >
                {pending ? "Procesando…" : "Confirmar venta (Enter)"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((method) => {
                const disabled = method.value === "fiado" && !customerId;
                return (
                  <button
                    key={method.value}
                    type="button"
                    disabled={disabled || pending}
                    onClick={() => pickMethod(method.value)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-40"
                    title={disabled ? "Elegí un cliente para vender fiado" : undefined}
                  >
                    <method.icon className="h-5 w-5 text-accent-foreground" />
                    {method.label}
                    {method.value === "fiado" && (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        (requiere cliente)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {!customerId && (
              <p className="text-xs text-muted-foreground">
                Para vender Fiado, primero elegí un cliente (no puede ser Consumidor Final).
              </p>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={showNewCustomer}
        onClose={() => {
          setShowNewCustomer(false);
          setCustomerError(null);
        }}
        title="Nuevo cliente"
        description="Cargá un cliente rápido para esta venta."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!creatingCustomer) handleCreateCustomer();
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Nombre <span className="font-normal text-muted-foreground">(Enter confirma)</span>
            </label>
            <Input
              autoFocus
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Nombre y apellido"
            />
          </div>

          {customerError && (
            <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              {customerError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowNewCustomer(false);
                setCustomerError(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={creatingCustomer || !newCustomerName.trim()}>
              {creatingCustomer ? "Guardando…" : "Crear y seleccionar (Enter)"}
            </Button>
          </div>
        </form>
      </Dialog>

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
