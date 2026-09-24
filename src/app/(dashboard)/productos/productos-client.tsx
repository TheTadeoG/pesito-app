"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
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
import { DropdownMenu, DropdownMenuItem, FilterPanel } from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/utils";
import type { Brand, Product, Supplier } from "@/lib/types";
import { ProductForm } from "@/app/(dashboard)/productos/product-form";
import { deleteProduct, toggleProductActive } from "@/app/(dashboard)/productos/actions";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";
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
const DEFAULT_COLUMNS: ColumnId[] = ALL_COLUMN_IDS.filter((id) => id !== "supplier");
const COLUMNS_STORAGE_KEY = "pesito-productos-columns";

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
      className={cn("px-3 py-2.5 font-semibold first:px-4", align === "right" && "text-right")}
      title={title}
    >
      <button
        type="button"
        onClick={() => onSort(sortKeyValue)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground"
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

export function ProductosClient({
  products,
  brands,
  suppliers,
  initialBrand,
}: {
  products: Product[];
  brands: Pick<Brand, "id" | "name">[];
  suppliers: SupplierOption[];
  // Viene de tocar el conteo de productos en la pestaña Marcas.
  initialBrand: string | null;
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
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkCostOpen, setBulkCostOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localBrands, setLocalBrands] = useState(brands);
  const [localSuppliers, setLocalSuppliers] = useState(suppliers);
  const [formKey, setFormKey] = useState(0);
  const [columns, setColumns] = useState<Set<ColumnId>>(new Set(DEFAULT_COLUMNS));
  const [showColumns, setShowColumns] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (raw) {
        const stored: string[] = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setColumns(new Set(stored.filter((id): id is ColumnId => ALL_COLUMN_IDS.includes(id as ColumnId))));
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
        window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const showColumn = (id: ColumnId) => columns.has(id);

  const supplierNameById = useMemo(
    () => new Map(localSuppliers.map((s) => [s.id, s.name])),
    [localSuppliers]
  );

  // products.brand es texto libre: puede haber marcas en productos que no
  // estén en el catálogo de marcas, así que se juntan las dos fuentes.
  const brandOptions = useMemo(() => {
    const names = new Set(localBrands.map((b) => b.name));
    for (const p of products) if (p.brand) names.add(p.brand);
    if (brandFilter) names.add(brandFilter);
    return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
  }, [localBrands, products, brandFilter]);

  const lowStockCount = useMemo(() => products.filter(isLowStock).length, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (brandFilter && p.brand !== brandFilter) return false;
      if (supplierFilter && p.default_supplier_id !== supplierFilter) return false;
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
    (noCostOnly ? 1 : 0);

  function getSortValue(p: Product, key: SortKey): string | number {
    switch (key) {
      case "name":
        return p.name.toLowerCase();
      case "brand":
        return (p.brand ?? "").toLowerCase();
      case "supplier":
        return (
          p.default_supplier_id ? supplierNameById.get(p.default_supplier_id) ?? "" : ""
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
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "es") * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, supplierNameById]);

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
    if (!confirm(`¿Borrar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    setBusyId(product.id);
    await deleteProduct(product.id);
    setBusyId(null);
  }

  async function handleToggleActive(product: Product) {
    setBusyId(product.id);
    await toggleProductActive(product.id, !product.active);
    setBusyId(null);
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
            onClick={() => setLowStockOnly((v) => !v)}
            aria-pressed={lowStockOnly}
            className={cn(
              "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors",
              lowStockOnly
                ? "border-danger/40 bg-danger-bg text-danger"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            Stock bajo
            {lowStockCount > 0 && <span className="font-semibold">({lowStockCount})</span>}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkPriceOpen(true)}>
            <TrendingUp className="h-4 w-4" />
            Aumentar precios
          </Button>
          <Button variant="outline" onClick={() => setBulkCostOpen(true)}>
            <TrendingUp className="h-4 w-4" />
            Aumentar costos
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
                  onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
                >
                  <option value="all">Todos</option>
                  <option value="active">Sólo activos</option>
                  <option value="inactive">Sólo inactivos</option>
                </Select>
              </div>

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
                : lowStockOnly && !query.trim() && !brandFilter && extraFilterCount === 0
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
                    <th className="px-4 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((product) => (
                    <tr
                      key={product.id}
                      className={cn(
                        "align-middle hover:bg-muted/30",
                        !product.active && "opacity-60"
                      )}
                    >
                      <td className="px-4 py-2.5">
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
                              <p className="truncate font-medium text-foreground">{product.name}</p>
                              {!product.active && <Badge>Inactivo</Badge>}
                            </div>
                          </div>
                        </div>
                      </td>
                      {showColumn("brand") && (
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {product.brand || "—"}
                        </td>
                      )}
                      {showColumn("supplier") && (
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {(product.default_supplier_id &&
                            supplierNameById.get(product.default_supplier_id)) ||
                            "—"}
                        </td>
                      )}
                      {showColumn("sku") && (
                        <td className="px-3 py-2.5 text-muted-foreground">{product.sku || "—"}</td>
                      )}
                      {showColumn("barcode") && (
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {product.barcode || "—"}
                        </td>
                      )}
                      {showColumn("cost") && (
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                          {product.cost ? formatCurrency(product.cost) : "—"}
                        </td>
                      )}
                      {showColumn("price") && (
                        <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                          {formatCurrency(product.price)}
                        </td>
                      )}
                      {showColumn("stock") && (
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={cn(
                              "font-medium",
                              product.stock <= product.min_stock
                                ? "text-danger"
                                : "text-foreground"
                            )}
                          >
                            {product.stock}
                            {product.unit}
                          </span>
                        </td>
                      )}
                      {showColumn("minStock") && (
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
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
                            <DropdownMenuItem onClick={() => setAdjusting(product)}>
                              <SlidersHorizontal className="h-4 w-4" />
                              Ajustar stock
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/productos?tab=stock&producto=${product.id}`)
                              }
                            >
                              <History className="h-4 w-4" />
                              Ver movimientos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPriceHistoryProduct(product)}>
                              <Receipt className="h-4 w-4" />
                              Historial de precios
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(product)}
                              disabled={busyId === product.id}
                            >
                              {product.active ? "Desactivar" : "Activar"}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductForm
        key={editing?.id ?? `new-${formKey}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        brands={localBrands}
        suppliers={localSuppliers}
        onBrandCreated={(brand) => setLocalBrands((current) => [...current, brand])}
        onSupplierCreated={(supplier) => setLocalSuppliers((current) => [...current, supplier])}
      />

      <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />

      <PriceHistoryDialog
        product={priceHistoryProduct}
        onClose={() => setPriceHistoryProduct(null)}
      />

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
