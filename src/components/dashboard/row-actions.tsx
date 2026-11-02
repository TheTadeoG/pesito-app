"use client";

import type { LucideIcon } from "lucide-react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export interface RowActionItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Si es true, no aparece en el menú. */
  hidden?: boolean;
}

/**
 * Acciones de una fila de lista, siempre con la misma forma: la acción principal como botón con ícono y las
 * demás en un menú «⋮». Aunque una fila tenga menos acciones, los botones quedan en el mismo lugar (el menú
 * reserva su espacio), así la columna se ve pareja. Mismo patrón que Productos.
 */
export function RowActions({
  primary,
  items,
}: {
  primary?: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean };
  items: RowActionItem[];
}) {
  const visible = items.filter((i) => !i.hidden);
  return (
    // Las filas se abren al hacer clic: lo de acá adentro no tiene que abrirlas (el menú también cuenta, es un portal).
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      {primary ? (
        <Button variant="outline" size="icon" onClick={primary.onClick} disabled={primary.disabled} aria-label={primary.label} title={primary.label}>
          <primary.icon className="h-4 w-4" />
        </Button>
      ) : (
        <span aria-hidden className="inline-block h-10 w-10 shrink-0" />
      )}
      {visible.length > 0 ? (
        <DropdownMenu
          trigger={
            <Button variant="outline" size="icon" aria-label="Más acciones" title="Más acciones">
              <MoreVertical className="h-4 w-4" />
            </Button>
          }
        >
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.label} onClick={item.onClick} danger={item.danger} disabled={item.disabled}>
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenu>
      ) : (
        <span aria-hidden className="inline-block h-10 w-10 shrink-0" />
      )}
    </div>
  );
}
