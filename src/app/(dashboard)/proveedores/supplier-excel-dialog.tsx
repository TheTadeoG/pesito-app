"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { cn } from "@/lib/utils";
import { downloadSuppliersExcel } from "@/app/(dashboard)/proveedores/supplier-excel";
import { downloadDebtExcel } from "@/app/(dashboard)/proveedores/debt-excel";
import { downloadSupplierTemplate } from "@/app/(dashboard)/proveedores/supplier-template";
import type { SupplierRow } from "@/lib/supplier-overview";

type Choice = "todos" | "deuda" | "modelo";

// Descargar Excel de proveedores: una sola ventana donde se elige qué bajar.
export function SupplierExcelDialog({
  open,
  onClose,
  rows,
  todayKey,
  accountsEnabled,
}: {
  open: boolean;
  onClose: () => void;
  rows: SupplierRow[];
  todayKey: string;
  accountsEnabled: boolean;
}) {
  const { showWarning } = useToast();
  const withDebt = rows.filter((r) => r.balance > 0).length;
  const [choice, setChoice] = useState<Choice>("todos");
  const [pending, setPending] = useState(false);

  const options: { id: Choice; title: string; text: string; disabled?: boolean }[] = [
    { id: "todos", title: `Todos los proveedores (${rows.length.toLocaleString("es-AR")})`, text: "Con su código, datos de contacto y entrega. Podés bajar el estado de cuenta de uno desde su ficha." },
    {
      id: "deuda",
      title: `Lo que les debés (${withDebt.toLocaleString("es-AR")})`,
      text: !accountsEnabled ? "Las cuentas corrientes con proveedores están desde el Plan Básico." : withDebt === 0 ? "Hoy no le debés a nadie." : "Compra por compra, con su vencimiento y lo que falta pagar.",
      disabled: !accountsEnabled || withDebt === 0,
    },
    { id: "modelo", title: "Planilla modelo (vacía)", text: "Con los títulos de columna listos para cargar proveedores nuevos." },
  ];

  async function download() {
    setPending(true);
    try {
      if (choice === "todos") {
        const problem = await downloadSuppliersExcel();
        if (problem) return void showWarning("No pudimos bajar los proveedores", problem);
      } else if (choice === "deuda") await downloadDebtExcel(rows, todayKey);
      else await downloadSupplierTemplate();
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
              <input type="radio" name="supplier-excel" disabled={o.disabled} checked={choice === o.id} onChange={() => setChoice(o.id)} className="mt-1 h-4 w-4 accent-primary" />
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
