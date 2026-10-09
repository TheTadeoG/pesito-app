"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns3,
  FileSpreadsheet,
  Filter,
  History,
  ImageIcon,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  ScanBarcode,
  Search,
  ShoppingCart,
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
  updateProductQuick,
} from "@/app/(dashboard)/productos/actions";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { BulkFieldIncreaseDialog } from "@/app/(dashboard)/productos/bulk-field-increase-dialog";
import { PriceHistoryDialog } from "@/app/(dashboard)/productos/price-history-dialog";
import { ProductImportDialog } from "@/app/(dashboard)/productos/import-dialog";
import { BarcodeLabelsDialog } from "@/app/(dashboard)/productos/barcode-labels-dialog";
import { featureMinPlan } from "@/lib/plan-access";
import { PlanLockNote, PlanPill, upgradeHref } from "@/components/dashboard/pro-locked-card";
import { InlineNumber } from "@/components/dashboard/inline-number";
import { loadIdleStock } from "@/app/(dashboard)/productos/idle-stock-action";
import { downloadStockExcel } from "@/app/(dashboard)/productos/stock-excel";
import { toStockRow, type StockFilterState } from "@/lib/stock-rows";
import { IDLE_DEFAULT_DAYS } from "@/lib/idle-days";
import type { Plan } from "@/lib/subscription";

type SupplierOption = Pick<Supplier, "id" | "name">;

// Cuántos productos con stock bajo se listan en Alertas.
const ALERT_STOCK_ROWS = 5;

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
  products: productsProp,
  brands,
  suppliers,
  initialBrand,
  orgId,
  bulkLocked,
  revertLocked,
  productUsage,
  stockAlertsLocked,
  importLocked,
  labelsLocked,
  canManageCatalog,
  restockLocked,
  initialStockState,
  idleAllowed,
}: {
  orgId: string;
  products: Product[];
  brands: Pick<Brand, "id" | "name">[];
  suppliers: SupplierOption[];
  // Viene de tocar el conteo de productos en la pestaña Marcas.
  initialBrand: string | null;
  // El plan no incluye ajustes masivos: los botones abren el aviso del plan.
  bulkLocked: boolean;
  /** Volver a un precio o costo anterior (Plan Pro). */
  revertLocked: boolean;
  /** Productos activos contra el límite del plan (y el plan que da más). */
  productUsage: { used: number; limit: number; nextPlan: Plan | null };
  // Sin gestión de stock (Plan Gratis): no se avisa ni se filtra por stock bajo.
  stockAlertsLocked: boolean;
  /** Carga masiva con Excel: el plan no la incluye (el botón abre el aviso del plan). */
  importLocked: boolean;
  /** Generar e imprimir códigos de barras: el plan no lo incluye. */
  labelsLocked: boolean;
  /** Sólo quien administra el negocio carga o imprime en masa. */
  canManageCatalog: boolean;
  /** Sin recomendaciones de reposición (Plan IA): "Comprar" va a Compras en vez de a Recomendaciones. */
  restockLocked: boolean;
  /** Viene de "Revisar números" (Stock): el filtro por estado ya puesto. */
  initialStockState: StockFilterState | null;
  /** Plan IA: se puede filtrar por "sin ventas". */
  idleAllowed: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState(initialBrand ?? "");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [noBarcodeOnly, setNoBarcodeOnly] = useState(false);
  // Estado del stock (chips): sin stock, por agotarse, sin ventas, sin costo, sin mínimo, negativo.
  const [stockState, setStockState] = useState<StockFilterState | null>(initialStockState);
  // Productos sin ventas en los últimos N días (Plan IA): se calculan recién al pedirlos.
  const [idleIds, setIdleIds] = useState<Set<string> | null>(null);
  const [idleLoading, setIdleLoading] = useState(false);
  const [idleError, setIdleError] = useState<string | null>(null);
  // Costo y mínimo corregidos desde la tabla (edición rápida, sin recargar la pantalla).
  const [edits, setEdits] = useState<Record<string, { cost?: number; min_stock?: number }>>({});
  const [exporting, setExporting] = useState(false);
  const products = useMemo(
    () => productsProp.map((p) => (edits[p.id] ? { ...p, ...edits[p.id] } : p)),
    [productsProp, edits],
  );
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
  const [importOpen, setImportOpen] = useState(false);
  const [importLockedOpen, setImportLockedOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelsLockedOpen, setLabelsLockedOpen] = useState(false);
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

  // Con un filtro por estado se ven las columnas que hacen falta para corregirlo.
  const forcedColumns: ColumnId[] =
    stockState === "nocost"
      ? ["cost"]
      : stockState === "nomin"
        ? ["minStock"]
        : stockState === "out" || stockState === "low" || stockState === "negative"
          ? ["stock", "minStock"]
          : [];
  const showColumn = (id: ColumnId) => columns.has(id) || forcedColumns.includes(id);

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

  // Con el plan sin gestión de stock igual se cuentan (y se avisa en la
  // campanita), pero la lista queda bloqueada con el plan que la trae.
  const lowStockProducts = useMemo(() => products.filter(isLowStock), [products]);
  const lowStockCount = lowStockProducts.length;
  // Para el aviso de alertas: primero lo más urgente (sin stock y lo más
  // lejos del mínimo), y sólo unos pocos; el resto se ve en Comprar.
  const lowStockTop = useMemo(
    () =>
      [...lowStockProducts]
        .sort(
          (a, b) =>
            a.stock / Math.max(a.min_stock, 1) - b.stock / Math.max(b.min_stock, 1) || a.stock - b.stock
        )
        .slice(0, ALERT_STOCK_ROWS),
    [lowStockProducts]
  );
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
      if (stockState && !p.active) return false;
      if (stockState === "out" && p.stock > 0) return false;
      if (stockState === "low" && !(p.stock > 0 && p.stock <= p.min_stock)) return false;
      if (stockState === "negative" && p.stock >= 0) return false;
      if (stockState === "nocost" && p.cost !== null && p.cost > 0) return false;
      if (stockState === "nomin" && p.min_stock > 0) return false;
      if (stockState === "idle" && !idleIds?.has(p.id)) return false;
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
    stockState,
    idleIds,
  ]);

  const extraFilterCount =
    (supplierFilter ? 1 : 0) +
    (activeFilter !== "all" ? 1 : 0) +
    (noBarcodeOnly ? 1 : 0);

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
    stockState,
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

  async function quickSave(id: string, field: "cost" | "min_stock", value: number): Promise<string | null> {
    const res = await updateProductQuick(id, field, value);
    if (res.error) return res.error;
    setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
    return null;
  }

  // Los "sin ventas" (Plan IA) se calculan al pedirlos, con el período de la pestaña Stock por defecto.
  async function loadIdle() {
    setIdleLoading(true);
    setIdleError(null);
    try {
      const res = await loadIdleStock(IDLE_DEFAULT_DAYS);
      if (res.rows) setIdleIds(new Set(res.rows.map((r) => r.id)));
      else setIdleError(res.error ?? "No pudimos calcularlo.");
    } catch {
      setIdleError("No pudimos calcularlo. Probá de nuevo.");
    } finally {
      setIdleLoading(false);
    }
  }

  function chooseState(next: StockFilterState | null) {
    setStockState(next);
    if (next === "idle" && idleIds === null && !idleLoading) void loadIdle();
  }

  // Si se llegó con ?estado=sin-ventas, se calcula al abrir.
  const idleRequested = useRef(false);
  useEffect(() => {
    if (initialStockState === "idle" && idleAllowed && !idleRequested.current) {
      idleRequested.current = true;
      void loadIdle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDownloadExcel() {
    setExporting(true);
    try {
      await downloadStockExcel(
        sorted.map((p) =>
          toStockRow(p, {
            supplier: p.default_supplier_id ? (supplierNameById.get(p.default_supplier_id) ?? null) : null,
            idle: idleIds?.has(p.id),
          }),
        ),
        false,
      );
    } finally {
      setExporting(false);
    }
  }

  // Cuántos hay en cada estado (sólo productos activos, como en la pestaña Stock).
  const stateCounts = useMemo(() => {
    const c = { out: 0, low: 0, nocost: 0, nomin: 0, negative: 0 };
    for (const p of products) {
      if (!p.active) continue;
      if (p.stock <= 0) c.out += 1;
      else if (p.stock <= p.min_stock) c.low += 1;
      if (p.stock < 0) c.negative += 1;
      if (p.cost === null || p.cost <= 0) c.nocost += 1;
      if (p.min_stock <= 0) c.nomin += 1;
    }
    return c;
  }, [products]);

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
          <DropdownMenu
            trigger={
              <Button variant="outline" className="whitespace-nowrap">
                Acciones
                <ChevronDown className="h-4 w-4" />
              </Button>
            }
          >
            <DropdownMenuItem onClick={() => void handleDownloadExcel()}>
              <FileSpreadsheet className="h-4 w-4" />
              {exporting ? "Preparando…" : `Descargar Excel (${sorted.length})`}
            </DropdownMenuItem>
            {canManageCatalog && (
              <>
                <DropdownMenuItem
                  onClick={() => (importLocked ? setImportLockedOpen(true) : setImportOpen(true))}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Cargar desde Excel
                  {importLocked && <Badge tone="accent">Esencial</Badge>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => (labelsLocked ? setLabelsLockedOpen(true) : setLabelsOpen(true))}
                >
                  <ScanBarcode className="h-4 w-4" />
                  Etiquetas con código de barras
                  {labelsLocked && <Badge tone="accent">Esencial</Badge>}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onClick={() => (bulkLocked ? setBulkLockedOpen(true) : setBulkPriceOpen(true))}
            >
              <TrendingUp className="h-4 w-4" />
              Ajustar precios
              {bulkLocked && <Badge tone="accent">Pro</Badge>}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => (bulkLocked ? setBulkLockedOpen(true) : setBulkCostOpen(true))}
            >
              <TrendingUp className="h-4 w-4" />
              Ajustar costos
              {bulkLocked && <Badge tone="accent">Pro</Badge>}
            </DropdownMenuItem>
          </DropdownMenu>
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

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
                <span className="text-foreground">Sin código de barras</span>
                <input
                  type="checkbox"
                  checked={noBarcodeOnly}
                  onChange={(e) => setNoBarcodeOnly(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            </div>
          </FilterPanel>
          {/* Cerca del límite del plan: cuántos productos activos quedan. */}
          {productUsage.used >= productUsage.limit * 0.8 && (
            <span className="text-xs text-muted-foreground">
              {`${productUsage.used.toLocaleString("es-AR")} de ${productUsage.limit.toLocaleString("es-AR")} productos`}
            </span>
          )}
          {productUsage.used >= productUsage.limit && productUsage.nextPlan ? (
            <Link
              href={`/suscribirse?plan=${productUsage.nextPlan}`}
              prefetch={false}
              title={`Llegaste a los ${productUsage.limit.toLocaleString("es-AR")} productos activos de tu plan`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Nuevo producto
              <PlanPill plan={productUsage.nextPlan} />
            </Link>
          ) : (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          )}
        </div>
      </div>

      {/* Estado del stock: filtros que también usa "Revisar números" de la pestaña Stock. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Estado del stock</span>
          <button
            type="button"
            onClick={() => chooseState(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              stockState === null ? "border-primary bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {`Todos · ${products.length}`}
          </button>
          {(
            [
              ["out", "Sin stock", stateCounts.out, "esencial"],
              ["low", "Por agotarse", stateCounts.low, "esencial"],
              ["idle", `Sin ventas ${IDLE_DEFAULT_DAYS} d`, idleIds ? idleIds.size : null, "ia"],
              ["nocost", "Sin costo", stateCounts.nocost, null],
              ["nomin", "Sin mínimo", stateCounts.nomin, "esencial"],
              ["negative", "Stock negativo", stateCounts.negative, null],
            ] as const
          ).map(([value, label, count, plan]) => {
            const locked = (plan === "esencial" && stockAlertsLocked) || (plan === "ia" && !idleAllowed);
            const text = count === null ? label : `${label} · ${count}`;
            if (locked && plan) {
              return (
                <Link
                  key={value}
                  href={upgradeHref(plan)}
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {text}
                  <PlanPill plan={plan} />
                </Link>
              );
            }
            return (
              <button
                key={value}
                type="button"
                onClick={() => chooseState(stockState === value ? null : value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  stockState === value ? "border-primary bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {text}
                {stockState === value && " ✕"}
              </button>
            );
          })}
        </div>
        {(stockState === "nocost" || stockState === "nomin") && (
          <p className="rounded-lg bg-accent px-3 py-2 text-sm text-foreground">
            {stockState === "nocost"
              ? "Escribí el costo en cada fila y apretá Enter. Con el costo, el valor del stock y tu margen quedan bien calculados."
              : "Escribí el stock mínimo en cada fila y apretá Enter: así Pesito te avisa cuando un producto se esté por acabar."}
          </p>
        )}
        {stockState === "negative" && (
          <p className="rounded-lg bg-accent px-3 py-2 text-sm text-foreground">
            Con “Ajustar stock” (en los tres puntos de cada fila) dejás el stock en el número real.
          </p>
        )}
        {stockState === "idle" && idleError && (
          <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{idleError}</p>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {products.length === 0
                ? "Todavía no cargaste productos. Creá el primero."
                : stockState === "idle" && idleLoading
                  ? "Calculando…"
                  : stockState &&
                      !query.trim() &&
                      !brandFilter &&
                      !supplierFilter &&
                      activeFilter === "all" &&
                      !noBarcodeOnly
                    ? "Ningún producto en esta lista. Todo en orden."
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
                            <InlineNumber
                              value={product.cost}
                              display={product.cost ? formatCurrency(product.cost) : "—"}
                              placeholder="Costo"
                              label={`costo de ${product.name}`}
                              open={stockState === "nocost" && (product.cost === null || product.cost <= 0)}
                              onSave={(v) => quickSave(product.id, "cost", v)}
                            />
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
                            <InlineNumber
                              value={product.min_stock}
                              display={`${product.min_stock}${product.unit}`}
                              placeholder="Mínimo"
                              label={`stock mínimo de ${product.name}`}
                              open={stockState === "nomin" && product.min_stock <= 0}
                              onSave={(v) => quickSave(product.id, "min_stock", v)}
                            />
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
        barcodeGenerate={{ locked: labelsLocked }}
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
            ) : stockAlertsLocked ? (
              <PlanLockNote plan="esencial">
                {`${lowStockProducts.length === 1 ? "Hay 1 producto" : `Hay ${lowStockProducts.length} productos`} por debajo del stock mínimo. Con el Plan Esencial ves cuáles son y te avisamos a tiempo para reponer.`}
              </PlanLockNote>
            ) : (
              <div>
                <div className="divide-y divide-border rounded-xl border border-border">
                  {lowStockTop.map((product) => (
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
                      <Link
                        href={restockLocked ? "/compras" : "/recomendaciones"}
                        prefetch={false}
                        onClick={() => setAlertsOpen(false)}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Comprar
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {lowStockProducts.length > lowStockTop.length
                      ? `Se muestran los ${lowStockTop.length} más urgentes de ${lowStockProducts.length}.`
                      : ""}
                  </p>
                  <Link
                    href={restockLocked ? "/compras" : "/recomendaciones"}
                    prefetch={false}
                    onClick={() => setAlertsOpen(false)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {restockLocked
                      ? "Ir a Compras"
                      : lowStockProducts.length > lowStockTop.length
                        ? `Ver las ${lowStockProducts.length} recomendaciones de compra`
                        : "Ver recomendaciones de compra"}
                  </Link>
                </div>
                {restockLocked && (
                  <PlanLockNote plan="ia">
                    Con el Plan IA ves cuánto comprar de cada producto y a qué proveedor, con el pedido
                    listo para mandar por WhatsApp.
                  </PlanLockNote>
                )}
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
        revertLocked={revertLocked}
      />

      <Dialog
        open={bulkLockedOpen}
        onClose={() => setBulkLockedOpen(false)}
        title="Ajustes masivos"
      >
        <ProLockedCard
          title="Ajustes masivos de precios y costos"
          description="Subí o bajá de una vez todos los productos de un proveedor o una marca, en porcentaje o monto fijo, y deshacelo si te equivocás."
        />
      </Dialog>
      <Dialog
        open={importLockedOpen}
        onClose={() => setImportLockedOpen(false)}
        title="Carga masiva con Excel"
      >
        <ProLockedCard
          title="Carga masiva de productos con Excel"
          plan={featureMinPlan.productImport}
          description="Subí una planilla con tu catálogo (nombre, código, costo, precio y stock) y cargá todos los productos juntos, en vez de uno por uno."
        />
      </Dialog>
      <Dialog
        open={labelsLockedOpen}
        onClose={() => setLabelsLockedOpen(false)}
        title="Etiquetas con código de barras"
      >
        <ProLockedCard
          title="Códigos de barras propios y etiquetas para imprimir"
          plan={featureMinPlan.barcodeLabels}
          description="Generá un código único para los productos que no tienen (no se repite nunca) e imprimí las etiquetas listas para pegar."
        />
      </Dialog>
      <ProductImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existing={products.map((p) => ({ barcode: p.barcode, sku: p.sku }))}
        remainingCapacity={Math.max(0, productUsage.limit - productUsage.used)}
      />
      <BarcodeLabelsDialog
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        products={products
          .filter((p) => p.active)
          .map((p) => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            price: p.price,
            brand: p.brand,
            supplierId: p.default_supplier_id,
          }))}
        brands={brandOptions}
        suppliers={localSuppliers}
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
