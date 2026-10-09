"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StockRow } from "@/lib/stock-rows";
import { EXCEL_COLUMNS, downloadStockExcel } from "@/app/(dashboard)/productos/stock-excel";

export interface ExportScope {
  id: string;
  label: string;
  hint?: string;
  count: number;
  rows: () => StockRow[];
}

const STORAGE_KEY = "pesito-excel-stock-columns";

/**
 * "Descargar Excel": se elige qué productos (lo que se está viendo, todos los activos o también los
 * inactivos) y qué columnas. Las columnas elegidas se recuerdan en este navegador.
 */
export function ExcelExportDialog({
  open,
  onClose,
  scopes,
  withCover,
}: {
  open: boolean;
  onClose: () => void;
  scopes: ExportScope[];
  /** Plan IA: se puede incluir "Alcanza para (días)". */
  withCover: boolean;
}) {
  const available = EXCEL_COLUMNS.filter((c) => withCover || !c.ia);
  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(available.map((c) => c.id)));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelected(new Set(ids.filter((id) => available.some((c) => c.id === id))));
      }
    } catch {
      // sin almacenamiento: se usan todas
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si cambian las opciones de productos (otro filtro), se vuelve a la primera.
  const scopeKey = scopes.map((s) => s.id).join("|");
  const [lastScopeKey, setLastScopeKey] = useState(scopeKey);
  if (lastScopeKey !== scopeKey) {
    setLastScopeKey(scopeKey);
    setScopeId(scopes[0]?.id ?? "");
  }

  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0];

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download() {
    if (!scope) return;
    setBusy(true);
    try {
      const ids = available.filter((c) => selected.has(c.id)).map((c) => c.id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      } catch {
        // ignore
      }
      await downloadStockExcel(scope.rows(), withCover, ids);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const chosen = available.filter((c) => selected.has(c.id)).length;

  return (
    <Dialog open={open} onClose={onClose} title="Descargar Excel" description="Elegí qué productos y qué columnas querés en la planilla.">
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-foreground">Productos</legend>
          {scopes.map((s) => (
            <label
              key={s.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                s.id === scope?.id ? "border-primary bg-accent" : "border-border hover:bg-muted"
              )}
            >
              <input
                type="radio"
                name="excel-scope"
                checked={s.id === scope?.id}
                onChange={() => setScopeId(s.id)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{`${s.label} (${s.count})`}</span>
                {s.hint && <span className="block text-xs text-muted-foreground">{s.hint}</span>}
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <div className="mb-1 flex items-center justify-between">
            <legend className="text-sm font-semibold text-foreground">Columnas</legend>
            <button
              type="button"
              onClick={() => setSelected(chosen === available.length ? new Set() : new Set(available.map((c) => c.id)))}
              className="text-xs font-medium text-primary hover:underline"
            >
              {chosen === available.length ? "Quitar todas" : "Marcar todas"}
            </button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">El nombre del producto va siempre.</p>
          <div className="grid grid-cols-2 gap-2">
            {available.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-primary" />
                <span className="text-foreground">{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy || !scope || scope.count === 0} onClick={() => void download()}>
            <Download className="h-4 w-4" />
            {busy ? "Preparando…" : `Descargar (${scope?.count ?? 0} productos)`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
