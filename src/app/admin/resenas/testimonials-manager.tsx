"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createTestimonial,
  updateTestimonial,
  toggleTestimonialPublished,
  deleteTestimonial,
  type TestimonialInput,
} from "@/app/admin/resenas/actions";

export interface TestimonialRow {
  id: string;
  name: string;
  location: string | null;
  business_type: string | null;
  rating: number;
  quote: string;
  published: boolean;
}

const emptyForm: TestimonialInput = {
  name: "",
  location: "",
  businessType: "",
  rating: 5,
  quote: "",
};

export function TestimonialsManager({ testimonials }: { testimonials: TestimonialRow[] }) {
  const [rows, setRows] = useState(testimonials);
  const [editing, setEditing] = useState<TestimonialRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TestimonialInput>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(row: TestimonialRow) {
    setEditing(row);
    setForm({
      name: row.name,
      location: row.location ?? "",
      businessType: row.business_type ?? "",
      rating: row.rating,
      quote: row.quote,
    });
    setError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = editing
      ? await updateTestimonial(editing.id, form)
      : await createTestimonial(form);

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    if (editing) {
      setRows((current) =>
        current.map((r) =>
          r.id === editing.id
            ? {
                ...r,
                name: form.name.trim(),
                location: form.location.trim() || null,
                business_type: form.businessType.trim() || null,
                rating: form.rating,
                quote: form.quote.trim(),
              }
            : r
        )
      );
    } else {
      // El id/orden real llegan con el próximo refresh del server
      // component; mientras tanto un id temporal alcanza para mostrarla.
      setRows((current) => [
        {
          id: `temp-${Date.now()}`,
          name: form.name.trim(),
          location: form.location.trim() || null,
          business_type: form.businessType.trim() || null,
          rating: form.rating,
          quote: form.quote.trim(),
          published: true,
        },
        ...current,
      ]);
    }
    setFormOpen(false);
  }

  async function handleToggle(row: TestimonialRow) {
    setBusyId(row.id);
    const result = await toggleTestimonialPublished(row.id, !row.published);
    setBusyId(null);
    if (result.error) return;
    setRows((current) =>
      current.map((r) => (r.id === row.id ? { ...r, published: !r.published } : r))
    );
  }

  async function handleDelete(row: TestimonialRow) {
    if (!confirm(`¿Borrar la reseña de ${row.name}? No se puede deshacer.`)) return;
    setBusyId(row.id);
    const result = await deleteTestimonial(row.id);
    setBusyId(null);
    if (result.error) return;
    setRows((current) => current.filter((r) => r.id !== row.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva reseña
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              Todavía no cargaste ninguna reseña.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex flex-wrap items-start justify-between gap-3 px-5 py-4",
                    !row.published && "opacity-60"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{row.name}</p>
                      {row.business_type && <Badge tone="accent">{row.business_type}</Badge>}
                      {!row.published && <Badge>Oculta</Badge>}
                      <span className="flex items-center gap-0.5 text-warning">
                        {Array.from({ length: row.rating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current" />
                        ))}
                      </span>
                    </div>
                    {row.location && (
                      <p className="text-xs text-muted-foreground">{row.location}</p>
                    )}
                    <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                      &ldquo;{row.quote}&rdquo;
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleToggle(row)}
                      disabled={busyId === row.id}
                      aria-label={row.published ? "Ocultar" : "Publicar"}
                      title={row.published ? "Ocultar de la landing" : "Publicar en la landing"}
                    >
                      {row.published ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEdit(row)}
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(row)}
                      disabled={busyId === row.id}
                      aria-label="Borrar"
                      title="Borrar"
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar reseña" : "Nueva reseña"}
        description="Se muestra en la landing apenas la guardás (salvo que la ocultes)."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-name" required>
                Nombre
              </Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Emilio"
                required
              />
            </div>
            <div>
              <Label htmlFor="t-location">Ciudad (opcional)</Label>
              <Input
                id="t-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Salta"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-business">Rubro (opcional)</Label>
              <Input
                id="t-business"
                value={form.businessType}
                onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
                placeholder="Kiosco"
              />
            </div>
            <div>
              <Label htmlFor="t-rating">Estrellas</Label>
              <div className="flex h-10 items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, rating: n }))}
                    className="text-warning"
                    aria-label={`${n} estrellas`}
                  >
                    <Star className={cn("h-5 w-5", n <= form.rating && "fill-current")} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="t-quote" required>
              Reseña
            </Label>
            <textarea
              id="t-quote"
              value={form.quote}
              onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
              rows={4}
              required
              placeholder="Lo que te dijo el cliente, tal cual."
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear reseña"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
