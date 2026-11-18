"use client";

import { cn } from "@/lib/utils";

export type SortState<K extends string> = { key: K; dir: 1 | -1 };

/** Siguiente orden al tocar una columna: la misma invierte; otra empieza en `firstDir` (1 = A→Z / menor primero). */
export function nextSort<K extends string>(cur: SortState<K>, key: K, firstDir: 1 | -1 = 1): SortState<K> {
  return cur.key === key ? { key, dir: (cur.dir * -1) as 1 | -1 } : { key, dir: firstDir };
}

/** Compara dos valores simples según el sentido del orden (para `array.sort`). */
export function compareBy(x: string | number, y: string | number, dir: 1 | -1): number {
  return (x < y ? -1 : x > y ? 1 : 0) * dir;
}

/** Título de columna que ordena la tabla al tocarlo. */
export function SortTh<K extends string>({
  label,
  k,
  sort,
  onSort,
  right,
  className,
}: {
  label: string;
  k: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  right?: boolean;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th
      className={cn("px-3 py-2.5", right && "text-right", className)}
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground", active && "text-foreground")}
      >
        {label}
        <span aria-hidden className="text-[10px]">
          {active ? (sort.dir === 1 ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}
