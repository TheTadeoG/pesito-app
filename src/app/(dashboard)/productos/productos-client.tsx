"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns3,
  Filter,
  History,
  ImageIcon,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuItem,
  FilterPanel,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/utils";
import type { Brand, Product, Supplier } from "@/lib/types";
import { ProductForm } from "@/app/(dashboard)/productos/product-form";
import {
  deleteProduct,
  toggleProductActive,
} from "@/app/(dashboard)/productos/actions";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { BulkFieldIncreaseDialog } from "@/app/(dashboard)/productos/bulk-field-increase-dialog";
import { PriceHistoryDialog } from "@/app/(dashboard)/productos/price-history-dialog";

type SupplierOption = Pick<Supplier, "id" | "name">;

const COLUMNS = [
  { id: "brand", label: "Marca" },
  { id: "supplier", label: "Proveedor" },
  { id: "sku", label: "SKU" },
  { id: "barcode", label: "Código de barras" },
  { id: "cost", label: "Costo" },
  { id: "price", label: "Precio de venta" },
  { id: "stock", label: "Stock" },
  { id: "minStock", label: "Mínimo" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];
const ALL_COLUMN_IDS = COLUMNS.map((c) => c.id);
const DEFAULT_COLUMNS: ColumnId[] = ALL_COLUMN_IDS.filter(
  (id) => id !== "supplier",
);
const COLUMNS_STORAGE_KEY = "pesito-productos-columns";

// Dibujar las 1.600 filas de un catálogo mediano de una vez tarda ~2 s: se
// muestran de a tandas y se agregan más al acercarse al final de la tabla.
// Buscar, filtrar y ordenar siguen trabajando sobre todos los productos.
const ROWS_PER_BATCH = 100;

type SortKey = "name" | ColumnId;
type SortDir = "asc" | "desc";
type ActiveFilter = "all" | "active" | "inactive";

function SortHeader({
  label,
  sortKeyValue,
  currentKey,
  currentDir,
  onSort,
  align = "left",
  title,
}: {
  label: string;
  sortKeyValue: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  title?: string;
}) {
  const active = currentKey === sortKeyValue;
  return (
    <th
      className={cn(
        "px-3 py-2.5 font-semibold first:px-4",
        align === "right" && "text-right",
      )}
      title={title}
    >
      <button
        type="button"
        onClick={() => onSort(sortKeyValue)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          currentDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

// Mismo criterio que el contador de la pestaña Stock (sólo productos activos).
const isLowStock = (p: Product) => p.active && p.stock <= p.min_stock;

// Mismo criterio que el aviso "estarías vendiendo a pérdida" del alta/edición.
const isSellingAtLoss = (p: Product) =>
  p.active && p.cost !== null && p.cost > p.price;

export function ProductosClient({
  products,
  brands,
  suppliers,
  initialBrand,
  orgId,
  bulkLocked,
  stockAlertsLocked,
}: {
  orgId: string;
  products: Product[];
  brands: Pick<Brand, "id" | "name">[];
  suppliers: SupplierOption[];
  // Viene de tocar el conteo de productos en la pestaña Marcas.
  initialBrand: string | null;
  // El plan no incluye aumentos masivos: los botones abren el aviso del plan.
  bulkLocked: boolean;
  // Sin gestión de stock (Plan Gratis): no se avisa ni se filtra por stock bajo.
  stockAlertsLocked: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState(initialBrand ?? "");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [noBarcodeOnly, setNoBarcodeOnly] = useState(false);
  const [noCostOnly, setNoCostOnly] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [priceHistoryProduct, setPriceHistoryProduct] =
    useState<Product | null>(null);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkCostOpen, setBulkCostOpen] = useState(false);
  const [bulkLockedOpen, setBulkLockedOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Activar/desactivar se ve al toque en vez de esperar el viaje al server +
  // la revalidación de la página — se corrige solo si la acción falla.
  const [activeOverrides, setActiveOverrides] = useState<
    Record<string, boolean>
  >({});
  const [localBrands, setLocalBrands] = useState(brands);
  const [localSuppliers, setLocalSuppliers] = useState(suppliers);
  const [formKey, setFormKey] = useState(0);
  const [columns, setColumns] = useState<Set<ColumnId>>(
    new Set(DEFAULT_COLUMNS),
  );
  const [showColumns, setShowColumns] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (raw) {
        const stored: string[] = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setColumns(
          new Set(
            stored.filter((id): id is ColumnId =>
              ALL_COLUMN_IDS.includes(id as ColumnId),
            ),
          ),
        );
      }
    } catch {
      // ignore malformed/blocked localStorage
    }
  }, []);

  function toggleColumn(id: ColumnId) {
    setColumns((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(
          COLUMNS_STORAGE_KEY,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // ignore
      }
      return next;
    });
  }

  const showColumn = (id: ColumnId) => columns.has(id);

  const supplierNameById = useMemo(
    () => new Map(localSuppliers.map((s) => [s.id, s.name])),
    [localSuppliers],
  );

  // products.brand es texto libre: puede haber marcas en productos que no
  // estén en el catálogo de marcas, así que se juntan las dos fuentes.
  const brandOptions = useMemo(() => {
    const names = new Set(localBrands.map((b) => b.name));
    for (const p of products) if (p.brand) names.add(p.brand);
    if (brandFilter) names.add(brandFilter);
    return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
  }, [localBrands, products, brandFilter]);

  const lowStockProducts = useMemo(
    () => (stockAlertsLocked ? [] : products.filter(isLowStock)),
    [products, stockAlertsLocked],
  );
  const lowStockCount = lowStockProducts.length;
  const lossProducts = useMemo(
    () => products.filter(isSellingAtLoss),
    [products],
  );
  const alertsCount = lowStockCount + lossProducts.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (brandFilter && p.brand !== brandFilter) return false;
      if (supplierFilter && p.default_supplier_id !== supplierFilter)
        return false;
      if (activeFilter === "active" && !p.active) return false;
      if (activeFilter === "inactive" && p.active) return false;
      if (noBarcodeOnly && p.barcode) return false;
      if (noCostOnly && p.cost !== null) return false;
      if (lowStockOnly && !isLowStock(p)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      );
    });
  }, [
    products,
    query,
    brandFilter,
    supplierFilter,
    activeFilter,
    noBarcodeOnly,
    noCostOnly,
    lowStockOnly,
  ]);

  const extraFilterCount =
    (supplierFilter ? 1 : 0) +
    (activeFilter !== "all" ? 1 : 0) +
    (noBarcodeOnly ? 1 : 0) +
    (noCostOnly ? 1 : 0) +
    (lowStockOnly ? 1 : 0);

  function getSortValue(p: Product, key: SortKey): string | number {
    switch (key) {
      case "name":
        return p.name.toLowerCase();
      case "brand":
        return (p.brand ?? "").toLowerCase();
      case "supplier":
        return (
          p.default_supplier_id
            ? (supplierNameById.get(p.default_supplier_id) ?? "")
            : ""
        ).toLowerCase();
      case "sku":
        return (p.sku ?? "").toLowerCase();
      case "barcode":
        return (p.barcode ?? "").toLowerCase();
      case "cost":
        return p.cost ?? -1;
      case "price":
        return p.price;
      case "stock":
        return p.stock;
      case "minStock":
        return p.min_stock;
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (typeof va === "string" && typeof vb === "string")
        return va.localeCompare(vb, "es") * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, supplierNameById]);

  // Cambiar la búsqueda, un filtro o el orden vuelve a la primera tanda.
  const listKey = [
    query,
    brandFilter,
    supplierFilter,
    activeFilter,
    noBarcodeOnly,
    noCostOnly,
    lowStockOnly,
    sortKey,
    sortDir,
  ].join("|");
  const [visibleCount, setVisibleCount] = useState(ROWS_PER_BATCH);
  const [visibleListKey, setVisibleListKey] = useState(listKey);
  if (visibleListKey !== listKey) {
    setVisibleListKey(listKey);
    setVisibleCount(ROWS_PER_BATCH);
  }
  const visibleRows = sorted.slice(0, visibleCount);
  const hiddenCount = sorted.length - visibleRows.length;

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || hiddenCount === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setVisibleCount((c) => c + ROWS_PER_BATCH);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hiddenCount]);

  function handleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function handleDelete(product: Product) {
    if (
      !confirm(`¿Borrar "${product.name}"? Esta acción no se puede deshacer.`)
    )
      return;
    setBusyId(product.id);
    await deleteProduct(product.id);
    setBusyId(null);
  }

  async function handleToggleActive(product: Product) {
    const nextActive = !product.active;
    setActiveOverrides((current) => ({ ...current, [product.id]: nextActive }));
    setBusyId(product.id);
    const result = await toggleProductActive(product.id, nextActive);
    setBusyId(null);
    if (result.error) {
      setActiveOverrides((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:flex-1 lg:w-96 lg:flex-none">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, marca, SKU o código…"
              className="pl-10"
            />
          </div>
          <Select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            aria-label="Filtrar por marca"
            className="sm:w-48"
          >
            <option value="">Todas las marcas</option>
            {brandOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setAlertsOpen(true)}
            title="Alertas: stock bajo y productos vendiendo a pérdida"
            className={cn(
              "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors",
              alertsCount > 0
                ? "border-danger/40 bg-danger-bg text-danger"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <Bell className="h-4 w-4" />
            {alertsCount > 0 && (
              <span className="font-semibold">{alertsCount}</span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => (bulkLocked ? setBulkLockedOpen(true) : setBulkPriceOpen(true))}
          >
            <TrendingUp className="h-4 w-4" />
            Aumentar precios
            {bulkLocked && <Badge tone="accent">Pro</Badge>}
          </Button>
          <Button
            variant="outline"
            onClick={() => (bulkLocked ? setBulkLockedOpen(true) : setBulkCostOpen(true))}
          >
            <TrendingUp className="h-4 w-4" />
            Aumentar costos
            {bulkLocked && <Badge tone="accent">Pro</Badge>}
          </Button>
          <Button variant="outline" onClick={() => setShowColumns(true)}>
            <Columns3 className="h-4 w-4" />
            Columnas
          </Button>
          <FilterPanel
            trigger={
              <Button variant="outline">
                <Filter className="h-4 w-4" />
                Filtros
                {extraFilterCount > 0 && (
                  <span className="font-semibold">({extraFilterCount})</span>
                )}
              </Button>
            }
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Filtrar por
                </p>
                {extraFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierFilter("");
                      setActiveFilter("all");
                      setNoBarcodeOnly(false);
                      setNoCostOnly(false);
                      setLowStockOnly(false);
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>

              <div>
                <Label htmlFor="pf-supplier">Proveedor</Label>
                <Select
                  id="pf-supplier"
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                >
                  <option value="">Todos los proveedores</option>
                  {localSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="pf-active">Estado</Label>
                <Select
                  id="pf-active"
                  value={activeFilter}
                  onChange={(e) =>
                    setActiveFilter(e.target.value as ActiveFilter)
                  }
                >
                  <option value="all">Todos</option>
                  <option value="active">Sólo activos</option>
                  <option value="inactive">Sólo inactivos</option>
                </Select>
              </div>

              {!stockAlertsLocked && (
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
                <span className="text-foreground">
                  Stock bajo
                  {lowStockCount > 0 && ` (${lowStockCount})`}
                </span>
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>
              )}
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
                <span className="text-foreground">Sin código de barras</span>
                <input
                  type="checkbox"
                  checked={noBarcodeOnly}
                  onChange={(e) => setNoBarcodeOnly(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
                <span className="text-foreground">Sin costo cargado</span>
                <input
                  type="checkbox"
                  checked={noCostOnly}
                  onChange={(e) => setNoCostOnly(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            </div>
          </FilterPanel>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {products.length === 0
                ? "Todavía no cargaste productos. Creá el primero."
                : lowStockOnly &&
                    !query.trim() &&
                    !brandFilter &&
                    !supplierFilter &&
                    activeFilter === "all" &&
                    !noBarcodeOnly &&
                    !noCostOnly
                  ? "Ningún producto está por debajo de su stock mínimo."
                  : "No encontramos productos con esos filtros."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <SortHeader
                      label="Producto"
                      sortKeyValue="name"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    {showColumn("brand") && (
                      <SortHeader
                        label="Marca"
                        sortKeyValue="brand"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    )}
                    {showColumn("supplier") && (
                      <SortHeader
                        label="Proveedor"
                        sortKeyValue="supplier"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    )}
                    {showColumn("sku") && (
                      <SortHeader
                        label="SKU"
                        sortKeyValue="sku"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    )}
                    {showColumn("barcode") && (
                      <SortHeader
                        label="Código de barras"
                        sortKeyValue="barcode"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    )}
                    {showColumn("cost") && (
                      <SortHeader
                        label="Costo"
                        sortKeyValue="cost"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                        title="Lo que pagás vos al proveedor"
                      />
                    )}
                    {showColumn("price") && (
                      <SortHeader
                        label="Precio de venta"
                        sortKeyValue="price"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                        title="Lo que le cobrás al cliente"
                      />
                    )}
                    {showColumn("stock") && (
                      <SortHeader
                        label="Stock"
                        sortKeyValue="stock"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    )}
                    {showColumn("minStock") && (
                      <SortHeader
                        label="Mínimo"
                        sortKeyValue="minStock"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    )}
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRows.map((product) => {
                    // El override optimista hace que el estado se vea al
                    // toque al activar/desactivar, sin esperar el viaje al
                    // server — ver handleToggleActive.
                    const isActive =
                      activeOverrides[product.id] ?? product.active;
                    return (
                      <tr
                        key={product.id}
                        className="align-middle hover:bg-muted/30"
                      >
                        <td
                          className={cn(
                            "px-4 py-2.5",
                            !isActive && "opacity-60",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-muted-foreground">
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
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate font-medium text-foreground">
                                  {product.name}
                                </p>
                                {!isActive && <Badge>Inactivo</Badge>}
                              </div>
                            </div>
                          </div>
                        </td>
                        {showColumn("brand") && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-muted-foreground",
                              !isActive && "opacity-60",
                            )}
                          >
                            {product.brand || "—"}
                          </td>
                        )}
                        {showColumn("supplier") && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-muted-foreground",
                              !isActive && "opacity-60",
                            )}
                          >
                            {(product.default_supplier_id &&
                              supplierNameById.get(
                                product.default_supplier_id,
                              )) ||
                              "—"}
                          </td>
                        )}
                        {showColumn("sku") && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-muted-foreground",
                              !isActive && "opacity-60",
                            )}
                          >
                            {product.sku || "—"}
                          </td>
                        )}
                        {showColumn("barcode") && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-muted-foreground",
                              !isActive && "opacity-60",
                            )}
                          >
                            {product.barcode || "—"}
                          </td>
                        )}
                        {showColumn("cost") && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-right text-muted-foreground",
                              !isActive && "opacity-60",
                            )}
                          >
                            {product.cost ? formatCurrency(product.cost) : "—"}
                          </td>
                        )}
                        {showColumn("price") && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-right font-semibold text-foreground",
                              !isActive && "opacity-60",
                            )}
                          >
                            {formatCurrency(product.price)}
                          </td>
                        )}
                        {showColumn("stock") && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-right",
                              !isActive && "opacity-60",
                            )}
                          >
                            <span
                              className={cn(
                                "font-medium",
                                product.stock <= product.min_stock
                                  ? "text-danger"
                                  : "text-foreground",
                              )}
                            >
                              {product.stock}
                              {product.unit}
                            </span>
                          </td>
                        )}
                        {showColumn("minStock") && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-right text-muted-foreground",
                              !isActive && "opacity-60",
                            )}
                          >
                            {product.min_stock}
                            {product.unit}
                          </td>
                        )}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEdit(product)}
                              aria-label="Editar"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DropdownMenu
                              trigger={
                                <Button
                                  variant="outline"
                                  size="icon"
                                  aria-label="Más acciones"
                                  title="Más acciones"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              }
                            >
                              <DropdownMenuItem
                                onClick={() => setAdjusting(product)}
                              >
                                <SlidersHorizontal className="h-4 w-4" />
                                Ajustar stock
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/productos?tab=stock&producto=${product.id}`,
                                  )
                                }
                              >
                                <History className="h-4 w-4" />
                                Ver movimientos
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setPriceHistoryProduct(product)}
                              >
                                <Receipt className="h-4 w-4" />
                                Historial de precios y costos
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(product)}
                                disabled={busyId === product.id}
                              >
                                {isActive ? "Desactivar" : "Activar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(product)}
                                disabled={busyId === product.id}
                                danger
                              >
                                <Trash2 className="h-4 w-4" />
                                Borrar
                              </DropdownMenuItem>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hiddenCount > 0 && (
                <div
                  ref={loadMoreRef}
                  className="border-t border-border px-4 py-3 text-center"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setVisibleCount((c) => c + ROWS_PER_BATCH)
                    }
                  >
                    Mostrar más ({hiddenCount} restantes)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductForm
        orgId={orgId}
        key={editing?.id ?? `new-${formKey}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        brands={localBrands}
        suppliers={localSuppliers}
        onBrandCreated={(brand) =>
          setLocalBrands((current) => [...current, brand])
        }
        onSupplierCreated={(supplier) =>
          setLocalSuppliers((current) => [...current, supplier])
        }
      />

      <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />

      <Dialog
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        title="Alertas"
        description="Productos que conviene revisar."
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              Stock bajo
              {lowStockProducts.length > 0 && ` (${lowStockProducts.length})`}
            </p>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ningún producto está por debajo de su stock mínimo.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Stock:{" "}
                        <span className="font-medium text-danger">
                          {product.stock}
                          {product.unit}
                        </span>
                        {" · "}Mínimo: {product.min_stock}
                        {product.unit}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAdjusting(product);
                        setAlertsOpen(false);
                      }}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Ajustar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              Vendiendo a pérdida
              {lossProducts.length > 0 && ` (${lossProducts.length})`}
            </p>
            {lossProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ningún producto tiene el costo por encima del precio de venta.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border">
                {lossProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Costo:{" "}
                        <span className="font-medium text-danger">
                          {formatCurrency(product.cost ?? 0)}
                        </span>
                        {" · "}Precio: {formatCurrency(product.price)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        openEdit(product);
                        setAlertsOpen(false);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Dialog>

      <PriceHistoryDialog
        product={priceHistoryProduct}
        onClose={() => setPriceHistoryProduct(null)}
      />

      <Dialog
        open={bulkLockedOpen}
        onClose={() => setBulkLockedOpen(false)}
        title="Aumentos masivos"
      >
        <ProLockedCard
          title="Aumentos masivos de precios y costos"
          description="Actualizá de una vez todos los productos de un proveedor o una marca, en porcentaje o monto fijo, y deshacelo si te equivocás."
        />
      </Dialog>
      <BulkFieldIncreaseDialog
        open={bulkPriceOpen}
        onClose={() => setBulkPriceOpen(false)}
        field="price"
        suppliers={localSuppliers}
        brands={localBrands}
        products={products}
      />

      <BulkFieldIncreaseDialog
        open={bulkCostOpen}
        onClose={() => setBulkCostOpen(false)}
        field="cost"
        suppliers={localSuppliers}
        brands={localBrands}
        products={products}
      />

      <Dialog
        open={showColumns}
        onClose={() => setShowColumns(false)}
        title="Columnas de la tabla"
        description="Elegí qué columnas ver. Se guarda en este dispositivo."
      >
        <div className="space-y-2">
          {COLUMNS.map((col) => (
            <label
              key={col.id}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm"
            >
              <span className="text-foreground">{col.label}</span>
              <input
                type="checkbox"
                checked={showColumn(col.id)}
                onChange={() => toggleColumn(col.id)}
                className="h-4 w-4 accent-primary"
              />
            </label>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
