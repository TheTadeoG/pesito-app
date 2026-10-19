"use client";

import { useState } from "react";
import { CheckCircle2, Globe, RotateCcw, Server, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteOldResolvedErrors, setErrorStatus } from "@/app/admin/errores/actions";
import { formatDateTime } from "@/lib/utils";

export interface ErrorRow {
  id: string;
  source: "server" | "client";
  message: string;
  stack: string | null;
  path: string | null;
  context: string | null;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: "new" | "resolved";
}

/** Los errores abiertos arriba y los resueltos abajo; marcar uno como resuelto lo baja (si vuelve a pasar, se reabre). */
export function ErrorInbox({ open, resolved }: { open: ErrorRow[]; resolved: ErrorRow[] }) {
  const [rows, setRows] = useState<ErrorRow[]>([...open, ...resolved]);
  const [error, setError] = useState<string | null>(null);

  async function change(row: ErrorRow, status: "new" | "resolved") {
    setError(null);
    const res = await setErrorStatus(row.id, status);
    if (res.error) return setError(res.error);
    setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, status } : r)));
  }

  async function clean() {
    setError(null);
    const res = await deleteOldResolvedErrors();
    if (res.error) return setError(res.error);
    const limit = Date.now() - 30 * 24 * 60 * 60 * 1000;
    setRows((cur) => cur.filter((r) => !(r.status === "resolved" && new Date(r.lastSeenAt).getTime() < limit)));
  }

  const openRows = rows.filter((r) => r.status === "new");
  const doneRows = rows.filter((r) => r.status === "resolved");
  return (
    <div className="space-y-6">
      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">{`Para mirar (${openRows.length})`}</h2>
        {openRows.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Sin errores abiertos.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {openRows.map((r) => (
              <Row key={r.id} row={r} action={<Button size="sm" variant="outline" onClick={() => change(r, "resolved")}>Resuelto</Button>} />
            ))}
          </div>
        )}
      </section>
      {doneRows.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">{`Resueltos (${doneRows.length})`}</h2>
            <Button size="sm" variant="ghost" onClick={clean}>
              <Trash2 className="h-3.5 w-3.5" />
              Borrar los de hace más de 30 días
            </Button>
          </div>
          <div className="space-y-3">
            {doneRows.map((r) => (
              <Row
                key={r.id}
                row={r}
                muted
                action={
                  <Button size="sm" variant="ghost" onClick={() => change(r, "new")}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reabrir
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ row, action, muted }: { row: ErrorRow; action: React.ReactNode; muted?: boolean }) {
  const Icon = row.source === "server" ? Server : Globe;
  return (
    <Card className={muted ? "opacity-70" : undefined}>
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold text-foreground">{row.message}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" />
                {row.source === "server" ? "Servidor" : "Navegador"}
              </span>
              {row.path && <span>{row.path}</span>}
              {row.context && <span>{row.context}</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={row.occurrences > 5 ? "warning" : "accent"}>{row.occurrences === 1 ? "1 vez" : `${row.occurrences} veces`}</Badge>
            {action}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{`Primera vez: ${formatDateTime(row.firstSeenAt)} · Última: ${formatDateTime(row.lastSeenAt)}`}</p>
        {row.stack && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver el detalle técnico</summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-[11px] text-foreground">{row.stack}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
