"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Número editable en la misma celda (costo o stock mínimo): tocás, escribís, Enter para guardar,
 * Esc para cancelar. Con `open` fijo (cuando se está corrigiendo justo ese dato) ya viene el campo.
 * Va dentro de un contenedor de ancho fijo: el Input trae w-full y no se achica con className.
 */
export function InlineNumber({
  value,
  display,
  placeholder,
  label,
  open,
  onSave,
}: {
  value: number | null;
  /** Cómo se ve el valor cuando no se está editando. */
  display: string;
  placeholder: string;
  label: string;
  open?: boolean;
  onSave: (value: number) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showInput = editing || open;

  function cancel() {
    setEditing(false);
    setDraft("");
    setError(null);
  }

  async function save() {
    if (saving) return;
    const text = draft.trim().replace(",", ".");
    if (text === "") return cancel();
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) {
      setError("Número inválido");
      return;
    }
    if (n === value) return cancel();
    setSaving(true);
    const err = await onSave(n);
    setSaving(false);
    if (err) setError(err);
    else cancel();
  }

  if (!showInput) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value === null ? "" : String(value));
          setEditing(true);
        }}
        title={`Cambiar ${label}`}
        aria-label={`Cambiar ${label}`}
        className="group inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {display}
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" />
      </button>
    );
  }

  return (
    <div className="ml-auto w-24">
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={draft}
        autoFocus={editing}
        disabled={saving}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            cancel();
          }
        }}
        onBlur={() => {
          if (editing && !open) void save();
        }}
        className={cn("h-8 px-2 text-right text-sm", error && "border-danger")}
      />
      {error && <p className="mt-0.5 text-right text-[11px] text-danger">{error}</p>}
    </div>
  );
}
