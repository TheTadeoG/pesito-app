"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

/** Cuántos ítems por página: lo elige la persona y se recuerda en este navegador. */
export function usePageSize(storageKey: string, initial: number): [number, (size: number) => void] {
  const [size, setSize] = useState(initial);
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(storageKey));
      if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSize(stored);
      }
    } catch {
      // sin almacenamiento: se usa el valor inicial
    }
  }, [storageKey]);
  function update(next: number) {
    setSize(next);
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // ignore
    }
  }
  return [size, update];
}

/** Cantidad de páginas y página válida (la 0 es la primera) para un total y un tamaño. */
export function pageBounds(total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  return { totalPages, safePage, start: safePage * pageSize, end: Math.min(total, (safePage + 1) * pageSize) };
}

/**
 * Pie de una lista paginada: "Mostrando 51–100 de 207", cuántos por página (lo elige la persona),
 * anterior y siguiente. No se muestra si todo entra en la primera página y es el tamaño más chico.
 */
export function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  noun = "productos",
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  noun?: string;
}) {
  const { totalPages, safePage, start, end } = pageBounds(total, page, pageSize);
  if (total <= PAGE_SIZE_OPTIONS[0]) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">{`Mostrando ${start + 1}–${end} de ${total} ${noun}`}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-muted-foreground">
          Por página
          {/* El Select trae w-full y no se achica con className: va en un contenedor de ancho fijo. */}
          <span className="inline-block w-20">
            <Select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Productos por página"
              className="h-9 px-2.5"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </span>
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Página anterior"
            disabled={safePage === 0}
            onClick={() => onPageChange(safePage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center text-muted-foreground">{`Página ${safePage + 1} de ${totalPages}`}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Página siguiente"
            disabled={safePage >= totalPages - 1}
            onClick={() => onPageChange(safePage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
