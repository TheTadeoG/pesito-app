"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { ProductForm } from "@/app/(dashboard)/productos/product-form";
import { deleteProduct, toggleProductActive } from "@/app/(dashboard)/productos/actions";

export function ProductosClient({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
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
            placeholder="Buscar producto…"
            className="pl-10"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {products.length === 0
                ? "Todavía no cargaste productos. Creá el primero."
                : "No encontramos productos con esa búsqueda."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-muted-foreground">
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
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{product.name}</p>
                        {!product.active && <Badge>Inactivo</Badge>}
                        {product.stock <= product.min_stock && (
                          <Badge tone="danger">Stock: {product.stock}{product.unit}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[product.brand, product.barcode, product.sku]
                          .filter(Boolean)
                          .join(" · ") || "Sin código"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(product.price)}
                    </span>
                    <span className="hidden text-sm text-muted-foreground sm:inline">
                      Stock: {product.stock}{product.unit}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(product)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(product)}
                        disabled={busyId === product.id}
                        aria-label="Borrar"
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(product)}
                      disabled={busyId === product.id}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {product.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
      />
    </div>
  );
}
