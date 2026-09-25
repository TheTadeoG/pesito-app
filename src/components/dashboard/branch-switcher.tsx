"use client";

import { useState, useTransition } from "react";
import { Store } from "lucide-react";
import { setCurrentBranch } from "@/lib/actions/branches";
import { useToast } from "@/components/toast/toast-provider";

export interface BranchSwitcherProps {
  branches: { id: string; name: string }[];
  currentId: string;
  canSwitch: boolean;
}

// Sucursal en la que se está trabajando. Dueños y administradores la
// cambian desde acá (queda guardada en una cookie); un vendedor sólo ve la
// suya. Con una sola sucursal no se muestra nada.
export function BranchSwitcher({ branches, currentId, canSwitch }: BranchSwitcherProps) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(currentId);
  const { showWarning } = useToast();

  if (branches.length < 2) return null;
  const current = branches.find((b) => b.id === currentId);

  if (!canSwitch) {
    return (
      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <Store className="h-3.5 w-3.5 shrink-0" />
        {current?.name}
      </p>
    );
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Store className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only">Sucursal</span>
      <select
        value={selected}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const previous = selected;
          setSelected(next);
          startTransition(async () => {
            const result = await setCurrentBranch(next);
            if (result.error) {
              setSelected(previous);
              showWarning("No pudimos cambiar de sucursal", result.error);
            }
          });
        }}
        className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-foreground disabled:opacity-60"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
