"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveSupplier, type SupplierFormInput } from "@/app/(dashboard)/proveedores/actions";
import type { Supplier } from "@/lib/types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    supplier?.payment_terms_days !== null && supplier?.payment_terms_days !== undefined
      ? String(supplier.payment_terms_days)
      : ""
  );
  const [deliveryDays, setDeliveryDays] = useState<number[]>(supplier?.delivery_days ?? []);
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
      paymentTermsDays,
      hadPaymentTerms:
        supplier?.payment_terms_days !== null && supplier?.payment_terms_days !== undefined,
      deliveryDays,
      hadDeliveryDays: (supplier?.delivery_days?.length ?? 0) > 0,
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
          <Label>Plazo de pago (opcional)</Label>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Plazo de pago">
            {(
              [
                ["", "Sin plazo"],
                ["0", "Contado"],
                ["7", "7 días"],
                ["15", "15 días"],
                ["30", "30 días"],
              ] as const
            ).map(([value, label]) => {
              const on = paymentTermsDays === value;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPaymentTermsDays(value)}
                  className={cn(
                    "h-9 rounded-lg border px-3 text-sm font-medium transition-colors",
                    on
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              );
            })}
            <Input
              type="number"
              min={0}
              max={365}
              step={1}
              value={["", "0", "7", "15", "30"].includes(paymentTermsDays) ? "" : paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              placeholder="Otro"
              aria-label="Otro plazo de pago en días"
              className="h-9 w-24"
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Cuánto tiempo tenés para pagarle. Al cargar una compra a cuenta, el vencimiento se completa
            automáticamente con este plazo (lo podés cambiar en cada compra).
          </p>
        </div>

        <div>
          <Label>Días de entrega (opcional)</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Días de entrega">
            {WEEKDAYS.map((label, day) => {
              const on = deliveryDays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDeliveryDays((current) =>
                      on ? current.filter((d) => d !== day) : [...current, day]
                    )
                  }
                  className={cn(
                    "h-9 min-w-12 rounded-lg border px-3 text-sm font-medium transition-colors",
                    on
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Los días en que el proveedor entrega. Aparecen en el calendario de Proveedores.
          </p>
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
