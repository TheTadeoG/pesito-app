"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { Brand, Product } from "@/lib/types";
import { ProductForm } from "@/app/(dashboard)/productos/product-form";
import { deleteProduct, toggleProductActive } from "@/app/(dashboard)/productos/actions";
import { AdjustDialog } from "@/components/dashboard/adjust-dialog";

export function ProductosClient({
  products,
  brands,
}: {
  products: Product[];
  brands: Pick<Brand, "id" | "name">[];
}) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localBrands, setLocalBrands] = useState(brands);

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
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
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
                    <th className="px-3 py-2.5 font-semibold">Marca</th>
                    <th className="px-3 py-2.5 font-semibold">SKU</th>
                    <th className="px-3 py-2.5 font-semibold">Código de barras</th>
                    <th className="px-3 py-2.5 text-right font-semibold" title="Lo que pagás vos al proveedor">
                      Costo
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold" title="Lo que le cobrás al cliente">
                      Precio de venta
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">Stock</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Mínimo</th>
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
                      <td className="px-3 py-2.5 text-muted-foreground">{product.brand || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{product.sku || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{product.barcode || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">
                        {product.cost ? formatCurrency(product.cost) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={cn(
                            "font-medium",
                            product.stock <= product.min_stock ? "text-danger" : "text-foreground"
                          )}
                        >
                          {product.stock}
                          {product.unit}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">
                        {product.min_stock}
                        {product.unit}
                      </td>
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
        onBrandCreated={(brand) => setLocalBrands((current) => [...current, brand])}
      />

      <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}
