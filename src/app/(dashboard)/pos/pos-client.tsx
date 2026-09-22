"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Minus,
  Plus,
  Scale,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { checkoutSale, type CheckoutItemInput } from "@/app/(dashboard)/pos/actions";

interface ProductLite {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  price: number;
  stock: number;
  unit: string;
}

interface CustomerLite {
  id: string;
  name: string;
}

type CartItem =
  | { kind: "product"; product: ProductLite; quantity: number }
  | { kind: "manual"; id: string; label: string; amount: number };

const paymentMethods = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "qr", label: "QR" },
  { value: "mixto", label: "Mixto" },
  { value: "fiado", label: "Fiado" },
] as const;

interface PosClientProps {
  orgId: string;
  cashRegisterId: string;
  products: ProductLite[];
  customers: CustomerLite[];
}

export function PosClient({ orgId, cashRegisterId, products, customers }: PosClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof paymentMethods)[number]["value"]>("efectivo");
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [showExtras, setShowExtras] = useState(false);
  const [showManualAmount, setShowManualAmount] = useState(false);
  const [manualLabel, setManualLabel] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastEnterAt = useRef<number>(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase() === q ||
          p.sku?.toLowerCase() === q
      )
      .slice(0, 8);
  }, [products, query]);

  const subtotal = cart.reduce((acc, item) => {
    if (item.kind === "product") return acc + item.product.price * item.quantity;
    return acc + item.amount;
  }, 0);
  const total = Math.max(0, subtotal - discount + surcharge);
  const itemCount = cart.reduce(
    (acc, item) => acc + (item.kind === "product" ? item.quantity : 1),
    0
  );

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

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    if (query.trim()) {
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

    const now = Date.now();
    if (now - lastEnterAt.current < 800) {
      lastEnterAt.current = 0;
      void processSale();
    } else {
      lastEnterAt.current = now;
    }
  }

  async function processSale() {
    if (cart.length === 0 || pending) return;
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
      paymentMethod,
      discount,
      surcharge,
      items,
    });

    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setCart([]);
    setDiscount(0);
    setSurcharge(0);
    setCustomerId("");
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
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar producto... (Enter para agregar)"
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
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Consumidor Final</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
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
                <span className="text-muted-foreground">Descuento:</span>
                <span className="font-medium text-danger">-{formatCurrency(discount)}</span>
              </div>
            )}
            {surcharge > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Recargo:</span>
                <span className="font-medium text-foreground">+{formatCurrency(surcharge)}</span>
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
              onClick={() => void processSale()}
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
              <SlidersHorizontal className="h-4 w-4" />
              Gestionar Extras
            </Button>

            {showExtras && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Descuento
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={discount || ""}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Recargo
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={surcharge || ""}
                      onChange={(e) => setSurcharge(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Medio de pago
                  </label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as typeof paymentMethod)
                    }
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
