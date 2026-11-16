"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBrand } from "@/app/(dashboard)/productos/actions";

// Nueva marca a mano. El padre cambia `key` al cerrar para que arranque vacío.
export function BrandFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    setError(null);
    const res = await saveBrand(undefined, name);
    setPending(false);
    if (res.error) return setError(res.error);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nueva marca" description="Sumá una marca para tus productos.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="brand-name" required>
            Nombre
          </Label>
          <Input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus required />
        </div>
        {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Guardando…" : "Guardar marca"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
