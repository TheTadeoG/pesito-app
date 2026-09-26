"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_SIZES = [5, 10, 25, 50];

/**
 * Paginado de una lista larga en el navegador: cuántas filas por página
 * (elegible y recordado en este navegador con `storageKey`) y página actual.
 */
export function usePager<T>(items: T[], storageKey: string, defaultSize = DEFAULT_SIZES[0]) {
  const [pageSize, setPageSizeState] = useState(defaultSize);
  const [page, setPage] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (DEFAULT_SIZES.includes(saved)) setPageSizeState(saved);
    } catch {
      // localStorage bloqueado: queda el valor por defecto
    }
  }, [storageKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount - 1);

  function setPageSize(size: number) {
    setPageSizeState(size);
    setPage(0);
    try {
      localStorage.setItem(storageKey, String(size));
    } catch {
      // ignore
    }
  }

  return {
    pageItems: items.slice(current * pageSize, current * pageSize + pageSize),
    page: current,
    pageCount,
    pageSize,
    total: items.length,
    setPage,
    setPageSize,
  };
}

export function ListPager({
  page,
  pageCount,
  pageSize,
  total,
  setPage,
  setPageSize,
  sizes = DEFAULT_SIZES,
  className,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  sizes?: number[];
  className?: string;
}) {
  if (total <= sizes[0]) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-2.5 text-xs text-muted-foreground",
        className
      )}
    >
      <label className="flex items-center gap-1.5">
        Mostrar
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-lg border border-border bg-card px-1.5 py-1 text-xs text-foreground"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-1">
        <span className="mr-1">{`${from}–${to} de ${total}`}</span>
        <button
          type="button"
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
          aria-label="Página anterior"
          className="rounded-lg p-1 hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setPage(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Página siguiente"
          className="rounded-lg p-1 hover:bg-muted disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
