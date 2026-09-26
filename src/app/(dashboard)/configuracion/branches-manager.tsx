"use client";

import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { useState, useTransition } from "react";
import { Pencil, Plus, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBranch, renameBranch } from "@/lib/actions/branches";

interface BranchRow {
  id: string;
  name: string;
  is_main: boolean;
}

export function BranchesManager({
  branches,
  canAddBranches,
}: {
  branches: BranchRow[];
  canAddBranches: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createBranch(newName);
      if (result.error) setError(result.error);
      else setNewName("");
    });
  }

  function saveRename(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await renameBranch(id, editName);
      if (result.error) setError(result.error);
      else setEditingId(null);
    });
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {branches.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
            {editingId === b.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveRename(b.id);
                }}
              >
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  aria-label="Nombre de la sucursal"
                />
                <Button type="submit" size="sm" disabled={pending}>
                  Guardar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  {b.name}
                  {b.is_main && <Badge>Principal</Badge>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(b.id);
                    setEditName(b.name);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Cambiar el nombre de ${b.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {canAddBranches ? (
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la nueva sucursal"
            aria-label="Nombre de la nueva sucursal"
          />
          <Button type="submit" disabled={pending || !newName.trim()} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </form>
      ) : (
        <PlanLockNote plan="ia">
          Sumar más sucursales (cada una con su stock y sus cajas) es del Plan IA.
        </PlanLockNote>
      )}

      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

      <p className="text-xs text-muted-foreground">
        Cada sucursal tiene su propio stock y sus cajas. A cada vendedor le asignás su sucursal
        desde Usuarios; vos cambiás de sucursal desde el menú.
      </p>
    </div>
  );
}
