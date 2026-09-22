"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Supplier } from "@/lib/types";
import { SupplierForm } from "@/app/(dashboard)/proveedores/supplier-form";
import { SupplierPaymentDialog } from "@/app/(dashboard)/proveedores/supplier-payment-dialog";
import { deleteSupplier } from "@/app/(dashboard)/proveedores/actions";

export function ProveedoresClient({ suppliers }: { suppliers: Supplier[] }) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  async function handleDelete(supplier: Supplier) {
    if (!confirm(`¿Borrar a "${supplier.name}"?`)) return;
    setBusyId(supplier.id);
    await deleteSupplier(supplier.id);
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
            placeholder="Buscar proveedor…"
            className="pl-10"
          />
        </div>
        <Button
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
                : "No encontramos proveedores con esa búsqueda."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{supplier.name}</p>
                      {supplier.balance > 0 && (
                        <Badge tone="warning">Le debés {formatCurrency(supplier.balance)}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[supplier.phone, supplier.email].filter(Boolean).join(" · ") ||
                        "Sin datos de contacto"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {supplier.balance > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setPaying(supplier)}>
                        <Wallet className="h-3.5 w-3.5" />
                        Registrar pago
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
      <SupplierPaymentDialog supplier={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
