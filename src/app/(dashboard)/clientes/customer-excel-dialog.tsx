"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadCustomersExcel, downloadCustomerTemplate } from "@/app/(dashboard)/clientes/customer-excel";
import type { ClienteRow } from "@/app/(dashboard)/clientes/clientes-client";

type Choice = "todos" | "deben" | "modelo";

// Descargar Excel de clientes: una sola ventana donde se elige qué bajar (todos, sólo los que deben o la planilla vacía).
export function CustomerExcelDialog({
  open,
  onClose,
  customers,
  todayKey,
}: {
  open: boolean;
  onClose: () => void;
  customers: ClienteRow[];
  todayKey: string;
}) {
  const debtors = customers.filter((c) => c.balance > 0).length;
  const [choice, setChoice] = useState<Choice>("todos");
  const [pending, setPending] = useState(false);

  const options: { id: Choice; title: string; text: string; disabled?: boolean }[] = [
    { id: "todos", title: `Todos los clientes (${customers.length.toLocaleString("es-AR")})`, text: "Con su código, datos de contacto, saldo y fechas. La podés editar y volver a subir con “Cargar desde Excel”." },
    {
      id: "deben",
      title: `Sólo los que deben (${debtors.toLocaleString("es-AR")})`,
      text: debtors === 0 ? "Hoy nadie te debe." : "La lista de deudores con cuánto debe cada uno y desde cuándo.",
      disabled: debtors === 0,
    },
    { id: "modelo", title: "Planilla modelo (vacía)", text: "Con los títulos de columna listos para cargar clientes nuevos." },
  ];

  async function download() {
    setPending(true);
    try {
      if (choice === "modelo") await downloadCustomerTemplate();
      else await downloadCustomersExcel(customers, todayKey, choice === "deben");
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Descargar Excel" description="Elegí qué querés bajar.">
      <div className="space-y-4">
        <fieldset className="space-y-2">
          {options.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                o.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                choice === o.id ? "border-primary bg-accent" : "border-border hover:bg-muted"
              )}
            >
              <input type="radio" name="customer-excel" disabled={o.disabled} checked={choice === o.id} onChange={() => setChoice(o.id)} className="mt-1 h-4 w-4 accent-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void download()} disabled={pending}>
            <Download className="h-4 w-4" />
            {pending ? "Descargando…" : "Descargar"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
