"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ImageIcon,
  Pencil,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import type { Brand, Product, Supplier } from "@/lib/types";
import { ProductForm } from "@/app/(dashboard)/productos/product-form";
import { deleteProduct, toggleProductActive } from "@/app/(dashboard)/productos/actions";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";

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

export function ProductosClient({
  products,
  brands,
  suppliers,
}: {
  products: Product[];
  brands: Pick<Brand, "id" | "name">[];
  suppliers: SupplierOption[];
}) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localBrands, setLocalBrands] = useState(brands);
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
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [products, query]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, marca, SKU o código…"
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowColumns(true)}>
            <Settings2 className="h-4 w-4" />
            Columnas
          </Button>
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
                : "No encontramos productos con esa búsqueda."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">Producto</th>
                    {showColumn("brand") && <th className="px-3 py-2.5 font-semibold">Marca</th>}
                    {showColumn("supplier") && (
                      <th className="px-3 py-2.5 font-semibold">Proveedor</th>
                    )}
                    {showColumn("sku") && <th className="px-3 py-2.5 font-semibold">SKU</th>}
                    {showColumn("barcode") && (
                      <th className="px-3 py-2.5 font-semibold">Código de barras</th>
                    )}
                    {showColumn("cost") && (
                      <th
                        className="px-3 py-2.5 text-right font-semibold"
                        title="Lo que pagás vos al proveedor"
                      >
                        Costo
                      </th>
                    )}
                    {showColumn("price") && (
                      <th
                        className="px-3 py-2.5 text-right font-semibold"
                        title="Lo que le cobrás al cliente"
                      >
                        Precio de venta
                      </th>
                    )}
                    {showColumn("stock") && (
                      <th className="px-3 py-2.5 text-right font-semibold">Stock</th>
                    )}
                    {showColumn("minStock") && (
                      <th className="px-3 py-2.5 text-right font-semibold">Mínimo</th>
                    )}
                    <th className="px-4 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((product) => (
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
                            onClick={() => setAdjusting(product)}
                            aria-label="Ajustar stock"
                            title="Ajustar stock"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEdit(product)}
                            aria-label="Editar"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDelete(product)}
                            disabled={busyId === product.id}
                            aria-label="Borrar"
                            title="Borrar"
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(product)}
                            disabled={busyId === product.id}
                            className="ml-1 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            {product.active ? "Desactivar" : "Activar"}
                          </button>
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
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        brands={localBrands}
        suppliers={suppliers}
        onBrandCreated={(brand) => setLocalBrands((current) => [...current, brand])}
      />

      <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />

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
