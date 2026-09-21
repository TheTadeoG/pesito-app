"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganizationName } from "@/app/(dashboard)/configuracion/actions";

export function OrgNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await updateOrganizationName(name);
    setPending(false);
    setMessage(
      result.error ? { text: result.error, error: true } : { text: "Guardado." }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="org-name">Nombre del negocio</Label>
        <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {message && (
          <span className={`text-sm ${message.error ? "text-danger" : "text-success"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
