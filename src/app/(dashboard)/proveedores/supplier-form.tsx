"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSupplier, type SupplierFormInput } from "@/app/(dashboard)/proveedores/actions";
import type { Supplier } from "@/lib/types";

interface SupplierFormProps {
  open: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
}

export function SupplierForm({ open, onClose, supplier }: SupplierFormProps) {
  const isEdit = Boolean(supplier);
  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(
    supplier?.lead_time_days !== null && supplier?.lead_time_days !== undefined
      ? String(supplier.lead_time_days)
      : ""
  );
  const [minOrderAmount, setMinOrderAmount] = useState(
    supplier?.min_order_amount !== null && supplier?.min_order_amount !== undefined
      ? String(supplier.min_order_amount)
      : ""
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const input: SupplierFormInput = {
      id: supplier?.id,
      name,
      phone,
      email,
      notes,
      leadTimeDays,
      hadLeadTime: supplier?.lead_time_days !== null && supplier?.lead_time_days !== undefined,
      minOrderAmount,
      hadMinOrder: supplier?.min_order_amount !== null && supplier?.min_order_amount !== undefined,
    };

    const result = await saveSupplier(input);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar proveedor" : "Nuevo proveedor"}
      description={isEdit ? supplier?.name : "Sumá un proveedor para tus compras."}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="s-name" required>
            Nombre
          </Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="s-phone">Teléfono</Label>
            <Input id="s-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="s-email">Email</Label>
            <Input
              id="s-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="s-lead">Plazo de entrega en días (opcional)</Label>
          <Input
            id="s-lead"
            type="number"
            min={0}
            max={90}
            step={1}
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            placeholder="Ej: 3"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Cuánto tarda en llegar un pedido. Con esto, las recomendaciones de compra te avisan cuándo
            pedir para no quedarte sin stock mientras llega.
          </p>
        </div>

        <div>
          <Label htmlFor="s-min">Pedido mínimo en pesos (opcional)</Label>
          <Input
            id="s-min"
            type="number"
            min={0}
            step="any"
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            placeholder="Ej: 50000"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Si el proveedor pide un monto mínimo para despachar, las recomendaciones te avisan cuánto
            falta para llegar.
          </p>
        </div>

        <div>
          <Label htmlFor="s-notes">Notas</Label>
          <Input id="s-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
