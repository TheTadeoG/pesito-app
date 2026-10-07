"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { setCurrentBranch } from "@/lib/actions/branches";
import { useToast } from "@/components/toast/toast-provider";

export interface BranchSwitcherProps {
  branches: { id: string; name: string }[];
  currentId: string;
  canSwitch: boolean;
  /** Sucursal de la caja abierta de esta persona (null: sin caja o una sola sucursal). */
  registerBranch?: { id: string; name: string } | null;
}

// Sucursal en la que se está trabajando. Dueños y administradores la
// cambian desde acá (queda guardada en una cookie); un vendedor sólo ve la
// suya. Con una sola sucursal no se muestra nada.
export function BranchSwitcher({ branches, currentId, canSwitch, registerBranch = null }: BranchSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Sucursal elegida que todavía espera confirmación (hay una caja abierta de otra).
  const [asking, setAsking] = useState<string | null>(null);
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

  function change(next: string) {
    const previous = selected;
    setSelected(next);
    startTransition(async () => {
      const result = await setCurrentBranch(next);
      if (result.error) {
        setSelected(previous);
        showWarning("No pudimos cambiar de sucursal", result.error);
      }
    });
  }

  const askingBranch = branches.find((b) => b.id === asking);

  return (
    <>
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Store className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only">Sucursal</span>
      <select
        value={selected}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          // Con una caja abierta en otra sucursal, se pregunta antes de cambiar.
          if (registerBranch && next !== registerBranch.id) {
            setAsking(next);
            return;
          }
          change(next);
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
      <Dialog
        open={Boolean(asking && registerBranch)}
        onClose={() => setAsking(null)}
        title={`Tu caja abierta es de ${registerBranch?.name ?? ""}`}
        description={`Si seguís en ${askingBranch?.name ?? "la otra sucursal"}, el punto de venta sigue vendiendo con la caja y el stock de ${registerBranch?.name ?? ""}.`}
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setAsking(null);
              if (registerBranch && selected !== registerBranch.id) change(registerBranch.id);
            }}
            className="block w-full rounded-xl border border-primary/40 bg-accent px-4 py-3 text-left"
          >
            <span className="block text-sm font-semibold text-foreground">{`Quedarme en ${registerBranch?.name ?? ""}`}</span>
            <span className="block text-xs text-muted-foreground">Seguís con tu caja abierta y su stock.</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAsking(null);
              router.push("/caja");
            }}
            className="block w-full rounded-xl border border-border px-4 py-3 text-left hover:bg-muted"
          >
            <span className="block text-sm font-semibold text-foreground">Cerrar mi caja primero</span>
            <span className="block text-xs text-muted-foreground">
              {`Te llevo a Caja: contás, cerrás y después cambiás a ${askingBranch?.name ?? "la otra sucursal"}.`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const next = asking;
              setAsking(null);
              if (next) change(next);
            }}
            className="block w-full rounded-xl border border-border px-4 py-3 text-left hover:bg-muted"
          >
            <span className="block text-sm font-semibold text-foreground">{`Solo mirar ${askingBranch?.name ?? "la otra sucursal"} (no vender)`}</span>
            <span className="block text-xs text-muted-foreground">
              {`Ves sus datos, pero el punto de venta queda en ${registerBranch?.name ?? ""}.`}
            </span>
          </button>
        </div>
      </Dialog>
    </>
  );
}
