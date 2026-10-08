"use client";

import { useState } from "react";
import { Bug, Check, Eye, Lightbulb, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDateTime } from "@/lib/utils";
import { deleteFeedback, setFeedbackStatus, type FeedbackStatus } from "@/app/admin/mensajes/actions";

export interface FeedbackRow {
  id: string;
  orgName: string;
  email: string | null;
  kind: "suggestion" | "problem";
  message: string;
  page: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

type Filter = "open" | "all" | "problem" | "suggestion";

const filters: { value: Filter; label: string }[] = [
  { value: "open", label: "Sin resolver" },
  { value: "problem", label: "Problemas" },
  { value: "suggestion", label: "Sugerencias" },
  { value: "all", label: "Todos" },
];

const statusLabel: Record<FeedbackStatus, string> = { new: "Nuevo", seen: "Visto", done: "Resuelto" };

export function FeedbackInbox({ rows: initial }: { rows: FeedbackRow[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = rows.filter((r) =>
    filter === "all" ? true : filter === "open" ? r.status !== "done" : r.kind === filter
  );
  const newCount = rows.filter((r) => r.status === "new").length;

  async function changeStatus(id: string, status: FeedbackStatus) {
    setBusy(id);
    setError(null);
    const res = await setFeedbackStatus(id, status);
    setBusy(null);
    if (res.error) return setError(res.error);
    setRows((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function remove(id: string) {
    if (!window.confirm("¿Borrar este mensaje? No se puede deshacer.")) return;
    setBusy(id);
    setError(null);
    const res = await deleteFeedback(id);
    setBusy(null);
    if (res.error) return setError(res.error);
    setRows((list) => list.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              filter === f.value
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">{`${newCount} sin leer`}</span>
      </div>

      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No hay mensajes acá.
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id} className={cn(r.status === "new" && "border-primary/50")}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.kind === "problem" ? "danger" : "accent"}>
                    {r.kind === "problem" ? (
                      <Bug className="mr-1 h-3 w-3" />
                    ) : (
                      <Lightbulb className="mr-1 h-3 w-3" />
                    )}
                    {r.kind === "problem" ? "Problema" : "Sugerencia"}
                  </Badge>
                  <Badge tone={r.status === "new" ? "warning" : r.status === "done" ? "success" : "default"}>
                    {statusLabel[r.status]}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{r.orgName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">{r.message}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {r.email && (
                    <a href={`mailto:${r.email}`} className="text-primary hover:underline">
                      {r.email}
                    </a>
                  )}
                  {r.page && <span>{`Pantalla: ${r.page}`}</span>}
                  <span className="ml-auto flex gap-2">
                    {r.status === "new" && (
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => changeStatus(r.id, "seen")}>
                        <Eye className="h-3.5 w-3.5" />
                        Marcar visto
                      </Button>
                    )}
                    {r.status !== "done" ? (
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => changeStatus(r.id, "done")}>
                        <Check className="h-3.5 w-3.5" />
                        Resuelto
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => changeStatus(r.id, "seen")}>
                        Reabrir
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Borrar"
                      disabled={busy === r.id}
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
