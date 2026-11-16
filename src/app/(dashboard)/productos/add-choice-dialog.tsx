"use client";

import { Download, FileSpreadsheet, PencilLine } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

// Pop up del menú Acciones para proveedores y marcas: se elige cómo cargarlos (a mano o desde Excel).
export function AddChoiceDialog({
  open,
  onClose,
  title,
  singular,
  plural,
  onManual,
  onExcel,
  onDownload,
  manage,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** "proveedor" / "marca". */
  singular: string;
  plural: string;
  onManual: () => void;
  onExcel: () => void;
  /** Bajar lo que ya hay a Excel (opcional). */
  onDownload?: { text: string; onClick: () => void };
  /** Ver y editar los que ya hay. */
  manage?: { label: string; onClick: () => void };
}) {
  const options = [
    { icon: PencilLine, title: "A mano", text: `Cargás un ${singular} escribiendo sus datos.`, onClick: onManual },
    { icon: FileSpreadsheet, title: "Desde Excel", text: `Subís una planilla y cargás varios ${plural} juntos.`, onClick: onExcel },
    ...(onDownload ? [{ icon: Download, title: "Descargar Excel", text: onDownload.text, onClick: onDownload.onClick }] : []),
  ];
  return (
    <Dialog open={open} onClose={onClose} title={title} description={`¿Cómo querés cargar ${plural}?`}>
      <div className={onDownload ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
        {options.map((o) => (
          <button
            key={o.title}
            type="button"
            onClick={() => {
              onClose();
              o.onClick();
            }}
            className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <o.icon className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">{o.title}</span>
            <span className="text-xs text-muted-foreground">{o.text}</span>
          </button>
        ))}
      </div>
      {manage && (
        <button
          type="button"
          onClick={() => {
            onClose();
            manage.onClick();
          }}
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          {manage.label}
        </button>
      )}
    </Dialog>
  );
}
