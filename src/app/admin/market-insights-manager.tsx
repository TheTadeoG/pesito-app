"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { businessTypes } from "@/lib/business-types";
import { createMarketInsight, deleteMarketInsight } from "@/app/admin/actions";

export interface MarketInsightRow {
  id: string;
  title: string;
  business_type: string | null;
  published_at: string;
}

export function MarketInsightsManager({ items }: { items: MarketInsightRow[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await createMarketInsight({ title, body, businessType: type || null, source });
    setPending(false);
    if (result.error) {
      setMessage({ text: result.error, error: true });
      return;
    }
    setTitle("");
    setBody("");
    setSource("");
    setMessage({ text: "Nota publicada." });
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Borrar esta nota?")) return;
    const result = await deleteMarketInsight(id);
    if (result.error) setMessage({ text: result.error, error: true });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Notas del análisis de mercado que ven los negocios del Plan IA. Cargá sólo información
          verificada y con fuente: la ven los clientes tal cual.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="mi-title">Título</Label>
            <Input id="mi-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </div>
          <div>
            <Label htmlFor="mi-type">Rubro</Label>
            <Select id="mi-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos los rubros</option>
              {businessTypes.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="mi-body">Texto</Label>
          <textarea
            id="mi-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={4000}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="mi-source">Fuente (opcional)</Label>
          <Input id="mi-source" value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            Publicar nota
          </Button>
          {message && (
            <span className={message.error ? "text-sm text-danger" : "text-sm text-muted-foreground"}>
              {message.text}
            </span>
          )}
        </div>
      </form>
      {items.length > 0 && (
        <div className="divide-y divide-border rounded-xl border border-border">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{i.title}</p>
                <p className="text-xs text-muted-foreground">
                  {`${i.published_at} · ${businessTypes.find((b) => b.value === i.business_type)?.label ?? "Todos los rubros"}`}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(i.id)}>
                Borrar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
