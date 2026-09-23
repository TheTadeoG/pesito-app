"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createPaymentMethod,
  deletePaymentMethod,
} from "@/app/(dashboard)/configuracion/payment-methods-actions";

export interface PaymentMethodRow {
  id: string;
  name: string;
}

const builtIn = ["Efectivo", "Tarjeta", "Transferencia", "QR"];

export function PaymentMethodsManager({ methods }: { methods: PaymentMethodRow[] }) {
  const [rows, setRows] = useState(methods);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);

    const result = await createPaymentMethod(name);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.id) {
      setRows((current) => [...current, { id: result.id!, name: name.trim() }]);
    }
    setName("");
  }

  async function handleDelete(row: PaymentMethodRow) {
    if (!confirm(`¿Borrar "${row.name}"? Las ventas o compras que ya lo usaron lo siguen mostrando.`))
      return;
    setBusyId(row.id);
    const result = await deletePaymentMethod(row.id);
    setBusyId(null);
    if (result.error) return;
    setRows((current) => current.filter((r) => r.id !== row.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {builtIn.map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
        {rows.map((row) => (
          <span
            key={row.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent py-1 pl-3 pr-1.5 text-xs font-medium text-accent-foreground"
          >
            {row.name}
            <button
              type="button"
              onClick={() => handleDelete(row)}
              disabled={busyId === row.id}
              aria-label={`Borrar ${row.name}`}
              className="flex h-5 w-5 items-center justify-center rounded-full text-accent-foreground/70 hover:bg-black/10 hover:text-accent-foreground disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Mercado Pago, Talo, Ualá…"
            maxLength={40}
          />
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Los que cargues acá aparecen junto a los de siempre en el Punto de Venta y en Compras. Se
        tratan como Tarjeta/Transferencia: no entran en el arqueo de efectivo.
      </p>
    </div>
  );
}
