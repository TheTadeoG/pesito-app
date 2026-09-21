"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Customer } from "@/lib/types";
import { CustomerForm } from "@/app/(dashboard)/clientes/customer-form";
import { PaymentDialog } from "@/app/(dashboard)/clientes/payment-dialog";
import { deleteCustomer } from "@/app/(dashboard)/clientes/actions";

export function ClientesClient({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [paying, setPaying] = useState<Customer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.document?.toLowerCase().includes(q)
    );
  }, [customers, query]);

  async function handleDelete(customer: Customer) {
    if (!confirm(`¿Borrar a "${customer.name}"?`)) return;
    setBusyId(customer.id);
    await deleteCustomer(customer.id);
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
            placeholder="Buscar cliente…"
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
          Nuevo cliente
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {customers.length === 0
                ? "Todavía no cargaste clientes."
                : "No encontramos clientes con esa búsqueda."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((customer) => (
                <div
                  key={customer.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{customer.name}</p>
                      {customer.balance > 0 && (
                        <Badge tone="warning">Debe {formatCurrency(customer.balance)}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[customer.phone, customer.email].filter(Boolean).join(" · ") ||
                        "Sin datos de contacto"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {customer.balance > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaying(customer)}
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        Registrar pago
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setEditing(customer);
                        setFormOpen(true);
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(customer)}
                      disabled={busyId === customer.id}
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

      <CustomerForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editing}
      />
      <PaymentDialog customer={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
