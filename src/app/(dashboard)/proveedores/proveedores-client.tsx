"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Package, Pencil, Plus, Search, Trash2, Wallet, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Supplier } from "@/lib/types";
import { SupplierForm } from "@/app/(dashboard)/proveedores/supplier-form";
import { SupplierPaymentDialog } from "@/app/(dashboard)/proveedores/supplier-payment-dialog";
import { deleteSupplier } from "@/app/(dashboard)/proveedores/actions";

export interface SupplierRow extends Supplier {
  /** Productos que le compramos (según las compras cargadas). */
  products: string[];
  totalPurchased: number;
  lastPurchaseAt: string | null;
}

type SortKey = "name" | "debt" | "last" | "purchased";

const TOP_DEBTORS = 5;

export function ProveedoresClient({
  suppliers,
  customPaymentMethods = [],
  accountsEnabled,
}: {
  suppliers: SupplierRow[];
  customPaymentMethods?: string[];
  // Cuenta corriente con proveedores: Plan Esencial (lib/plan-access.ts).
  accountsEnabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debtors = useMemo(
    () => suppliers.filter((s) => s.balance > 0).sort((a, b) => b.balance - a.balance),
    [suppliers]
  );
  const totalDebt = debtors.reduce((acc, s) => acc + s.balance, 0);

  const allProducts = useMemo(
    () => Array.from(new Set(suppliers.flatMap((s) => s.products))).sort((a, b) => a.localeCompare(b, "es")),
    [suppliers]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pq = productQuery.trim().toLowerCase();
    const rows = suppliers.filter((s) => {
      if (onlyDebt && s.balance <= 0) return false;
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !s.phone?.toLowerCase().includes(q) &&
        !s.email?.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (pq && !s.products.some((p) => p.toLowerCase().includes(pq))) return false;
      return true;
    });
    const sorted = [...rows];
    if (sort === "debt") sorted.sort((a, b) => b.balance - a.balance);
    if (sort === "purchased") sorted.sort((a, b) => b.totalPurchased - a.totalPurchased);
    if (sort === "last") sorted.sort((a, b) => (b.lastPurchaseAt ?? "").localeCompare(a.lastPurchaseAt ?? ""));
    return sorted;
  }, [suppliers, query, productQuery, onlyDebt, sort]);

  const hasFilters = Boolean(query || productQuery || onlyDebt);

  async function handleDelete(supplier: Supplier) {
    if (!confirm(`¿Borrar a "${supplier.name}"?`)) return;
    setBusyId(supplier.id);
    await deleteSupplier(supplier.id);
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      {accountsEnabled ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card>
            <CardContent className="space-y-4 py-5">
              <div>
                <p className="text-xs text-muted-foreground">Les debés en total</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalDebt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Proveedores con deuda</p>
                <p className="text-lg font-semibold text-foreground">
                  {`${debtors.length} de ${suppliers.length}`}
                </p>
              </div>
              {debtors.length > 0 && (
                <Button
                  variant={onlyDebt ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setOnlyDebt((v) => !v)}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {onlyDebt ? "Mostrando sólo a los que les debés" : "Ver sólo a los que les debés"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">A quién le debés más</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {debtors.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No les debés nada a tus proveedores.</p>
              ) : (
                debtors.slice(0, TOP_DEBTORS).map((s) => (
                  <Link key={s.id} href={`/proveedores/${s.id}`} className="block rounded-lg hover:bg-muted/60">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-foreground">{s.name}</span>
                      <span className="shrink-0 font-semibold text-foreground">{formatCurrency(s.balance)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-warning"
                        style={{ width: `${Math.max(4, (s.balance / debtors[0].balance) * 100)}%` }}
                      />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="flex-1">
              La cuenta corriente con proveedores (cuánto les debés y a quién) está en el Plan Esencial.
            </span>
            <Link href="/configuracion?tab=plan" prefetch={false} className="font-medium text-primary hover:underline">
              Ver planes
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o contacto…"
            aria-label="Buscar proveedor"
            className="pl-10"
          />
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Package className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Filtrar por producto que le comprás…"
            aria-label="Filtrar por producto"
            list="supplier-products"
            className="pl-10"
          />
          <datalist id="supplier-products">
            {allProducts.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Ordenar proveedores"
          className="lg:w-52"
        >
          <option value="name">Ordenar por nombre</option>
          {accountsEnabled && <option value="debt">Mayor deuda primero</option>}
          <option value="purchased">Más comprado primero</option>
          <option value="last">Última compra</option>
        </Select>
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setProductQuery("");
              setOnlyDebt(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}
        <Button
          className="lg:ml-auto"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {suppliers.length === 0
                ? "Todavía no cargaste proveedores."
                : "No hay proveedores con esos filtros."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              <div
                className={cn(
                  "hidden gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground lg:grid",
                  accountsEnabled
                    ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_7rem_8rem_8rem_auto]"
                    : "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_7rem_8rem_auto]"
                )}
              >
                <span>Proveedor</span>
                <span>Productos que le comprás</span>
                <span>Última compra</span>
                <span className="text-right">Total comprado</span>
                {accountsEnabled && <span className="text-right">Le debés</span>}
                <span className="w-[7.5rem]" />
              </div>
              {filtered.map((supplier) => (
                <div
                  key={supplier.id}
                  className={cn(
                    "grid gap-2 px-5 py-3.5 lg:items-center lg:gap-4",
                    accountsEnabled
                      ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_7rem_8rem_8rem_auto]"
                      : "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_7rem_8rem_auto]"
                  )}
                >
                  <Link
                    href={`/proveedores/${supplier.id}`}
                    title="Ver ficha del proveedor"
                    className="-mx-2.5 min-w-0 rounded-xl px-2.5 py-1 transition-colors hover:bg-muted"
                  >
                    <p className="truncate font-medium text-foreground">{supplier.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[supplier.phone, supplier.email].filter(Boolean).join(" · ") ||
                        "Sin datos de contacto"}
                    </p>
                  </Link>

                  <p
                    className="min-w-0 truncate text-sm text-muted-foreground"
                    title={supplier.products.join(", ")}
                  >
                    {supplier.products.length === 0
                      ? "Sin compras cargadas"
                      : `${supplier.products.length} ${supplier.products.length === 1 ? "producto" : "productos"}: ${supplier.products.slice(0, 3).join(", ")}${supplier.products.length > 3 ? "…" : ""}`}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    <span className="lg:hidden">Última compra: </span>
                    {supplier.lastPurchaseAt ? formatDate(supplier.lastPurchaseAt) : "—"}
                  </p>

                  <p className="text-sm text-foreground lg:text-right">
                    <span className="text-muted-foreground lg:hidden">Total comprado: </span>
                    {formatCurrency(supplier.totalPurchased)}
                  </p>

                  {accountsEnabled && (
                    <p className="text-sm lg:text-right">
                      {supplier.balance > 0 ? (
                        <Badge tone="warning">{formatCurrency(supplier.balance)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Al día</span>
                      )}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 lg:w-[7.5rem] lg:justify-end">
                    {supplier.balance > 0 && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPaying(supplier)}
                        aria-label="Registrar pago"
                        title="Registrar pago"
                      >
                        <Wallet className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setEditing(supplier);
                        setFormOpen(true);
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(supplier)}
                      disabled={busyId === supplier.id}
                      aria-label="Borrar"
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supplier={editing}
      />
      <SupplierPaymentDialog
        supplier={paying}
        onClose={() => setPaying(null)}
        customPaymentMethods={customPaymentMethods}
      />
    </div>
  );
}
