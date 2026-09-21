"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCustomer, type CustomerFormInput } from "@/app/(dashboard)/clientes/actions";
import type { Customer } from "@/lib/types";

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

export function CustomerForm({ open, onClose, customer }: CustomerFormProps) {
  const isEdit = Boolean(customer);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [document, setDocument] = useState(customer?.document ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const input: CustomerFormInput = {
      id: customer?.id,
      name,
      phone,
      email,
      document,
      notes,
    };

    const result = await saveCustomer(input);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      description={isEdit ? customer?.name : "Sumá un cliente para llevar su cuenta."}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="c-name">Nombre</Label>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-phone">Teléfono</Label>
            <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-doc">DNI / CUIT</Label>
            <Input id="c-doc" value={document} onChange={(e) => setDocument(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input
            id="c-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="c-notes">Notas</Label>
          <Input id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
