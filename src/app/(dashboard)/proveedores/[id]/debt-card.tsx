"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import type { DebtItem } from "@/lib/supplier-debt";
import { setPurchaseDueDate } from "@/app/(dashboard)/proveedores/actions";
import { shortDate } from "@/app/(dashboard)/proveedores/debt-format";

const STATUS_CHIP: Record<DebtItem["status"], string> = {
  vencida: "bg-danger-bg text-danger",
  pronto: "bg-warning-bg text-warning",
  no_vencida: "bg-success-bg text-success",
  sin_fecha: "bg-muted text-muted-foreground",
};

function statusText(item: DebtItem): string {
  if (!item.dueDate || item.daysToDue === null) return "Sin fecha de vencimiento";
  if (item.daysToDue < 0) {
    const n = -item.daysToDue;
    return `Vencida hace ${n} ${n === 1 ? "día" : "días"} (${shortDate(item.dueDate)})`;
  }
  if (item.daysToDue === 0) return "Vence hoy";
  if (item.daysToDue === 1) return `Vence mañana (${shortDate(item.dueDate)})`;
  return `Vence el ${shortDate(item.dueDate)} (en ${item.daysToDue} días)`;
}

// Lo que se le debe al proveedor, compra por compra y con su vencimiento
// (se puede asignar o cambiar la fecha).
export function SupplierDebtCard({ items }: { items: DebtItem[] }) {
  const sorted = [...items].sort((a, b) =>
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
    a.purchaseDay.localeCompare(b.purchaseDay)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lo que le debés, compra por compra</CardTitle>
        <p className="text-sm text-muted-foreground">
          Los pagos se aplican primero a lo que vence antes.
        </p>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {sorted.map((item, idx) => (
          <DebtRow key={item.purchaseId ?? `adj-${idx}`} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

function DebtRow({ item }: { item: DebtItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(item.dueDate ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string | null) {
    if (!item.purchaseId) return;
    setPending(true);
    setError(null);
    const result = await setPurchaseDueDate(item.purchaseId, value);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="space-y-2 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {item.purchaseId ? `Compra del ${shortDate(item.purchaseDay)}` : "Saldo sin compra asociada"}
          </p>
          <span
            className={cn(
              "mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold",
              STATUS_CHIP[item.status]
            )}
          >
            {statusText(item)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-base font-bold text-warning">{formatCurrency(item.amount)}</p>
          {item.purchaseId && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {item.dueDate ? "Cambiar fecha" : "Asignar fecha"}
            </Button>
          )}
        </div>
      </div>
      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Fecha de vencimiento"
              className="h-9"
            />
          </div>
          <Button size="sm" disabled={!date || pending} onClick={() => save(date)}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          {item.dueDate && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => save(null)}>
              Quitar fecha
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
