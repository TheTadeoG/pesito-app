"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Brand } from "@/lib/types";
import { saveBrand, deleteBrand } from "@/app/(dashboard)/marcas/actions";

export function MarcasClient({ brands }: { brands: Brand[] }) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    setError(null);
    const result = await saveBrand(undefined, newName);
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewName("");
  }

  function startEdit(brand: Brand) {
    setEditingId(brand.id);
    setEditingName(brand.name);
    setError(null);
  }

  async function confirmEdit(id: string) {
    if (!editingName.trim()) return;
    setBusyId(id);
    setError(null);
    const result = await saveBrand(id, editingName);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditingId(null);
  }

  async function handleDelete(brand: Brand) {
    if (!confirm(`¿Borrar la marca "${brand.name}"? Los productos que ya la tenían la conservan.`))
      return;
    setBusyId(brand.id);
    await deleteBrand(brand.id);
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
            placeholder="Buscar marca…"
            className="pl-10"
          />
        </div>
        <form onSubmit={handleCreate} className="flex w-full gap-2 sm:w-auto">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la marca"
            className="sm:w-56"
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            <Plus className="h-4 w-4" />
            {creating ? "Creando…" : "Nueva marca"}
          </Button>
        </form>
      </div>

      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {brands.length === 0
                ? "Todavía no cargaste marcas."
                : "No encontramos marcas con esa búsqueda."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((brand) => (
                <div
                  key={brand.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  {editingId === brand.id ? (
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          confirmEdit(brand.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="max-w-xs"
                    />
                  ) : (
                    <p className="truncate font-medium text-foreground">{brand.name}</p>
                  )}

                  <div className="flex items-center gap-1.5">
                    {editingId === brand.id ? (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => confirmEdit(brand.id)}
                          disabled={busyId === brand.id}
                          aria-label="Guardar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => startEdit(brand)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(brand)}
                          disabled={busyId === brand.id}
                          aria-label="Borrar"
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
