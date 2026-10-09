"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, CircleCheck, Download, Lock, Pencil, Search, ShoppingCart, SlidersHorizontal, TrendingDown, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PlanPill, upgradeHref } from "@/components/dashboard/pro-locked-card";
import { cn, formatCurrency } from "@/lib/utils";
import { planLabels, type Plan } from "@/lib/subscription";
import { IDLE_DAYS_OPTIONS } from "@/lib/idle-days";
import { PaginationBar, pageBounds, usePageSize } from "@/components/dashboard/pagination-bar";
import { ExcelExportDialog, type ExportScope } from "@/app/(dashboard)/productos/excel-export-dialog";
import type { StockRow, StockStatus } from "@/lib/stock-rows";

// "restock" = sin stock + por agotarse (lo que hay que reponer). "all" = todos los productos.
type Filter = "all" | "restock" | "out" | "low" | "ok" | "excess";
type Sort = "urgency" | "name" | "stock" | "value";

const DEFAULT_PAGE_SIZE = 25;

const statusLabel: Record<StockStatus, string> = {
  out: "Sin stock",
  low: "Por agotarse",
  ok: "OK",
  excess: "Sin ventas",
};
const statusTone: Record<StockStatus, string> = {
  out: "bg-danger-bg text-danger",
  low: "bg-warning-bg text-warning",
  ok: "bg-success-bg text-success",
  excess: "bg-accent text-accent-foreground",
};
const segmentColor: Record<StockStatus, string> = {
  ok: "bg-emerald-400",
  low: "bg-amber-400",
  out: "bg-red-400",
  excess: "bg-blue-400",
};

function qty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function daysLabel(days: number | null | undefined): string {
  if (days === undefined) return "";
  if (days === null) return "Sin ventas";
  if (days <= 0) return "0 días";
  if (days < 1) return "Menos de 1 día";
  if (days > 365) return "Más de 1 año";
  const n = Math.floor(days);
  return n === 1 ? "1 día" : `${n} días`;
}

/**
 * Vista "Inventario" de la pestaña Stock: tres fichas de una línea (reponer, capital parado, revisar
 * números) y una sola tarjeta con la lista de productos: buscador, filtros, chips por estado, barra
 * de salud y tabla paginada. Para editar precios y costos, el catálogo (Productos).
 */
export function StockBoard({
  rows,
  insightsOn,
  lockedPlan,
  slow,
  idleDays,
  idleLoading,
  idleError,
  onIdleDaysChange,
  restockHref,
  onEdit,
  onAdjust,
}: {
  rows: StockRow[];
  /** Plan IA: se ven los días que alcanza el stock y los productos sin ventas. */
  insightsOn: boolean;
  /** Plan que desbloquea lo anterior (null si ya lo tiene). */
  lockedPlan: Plan | null;
  /** Productos con plata parada (Plan IA), de mayor a menor capital. */
  slow: { id: string; name: string; capital: number }[];
  /** Período de "sin ventas" de la lista de arriba. */
  idleDays: number;
  idleLoading: boolean;
  idleError: string | null;
  onIdleDaysChange: (days: number) => void;
  restockHref: string | null;
  onEdit: (id: string) => void;
  onAdjust: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [supplier, setSupplier] = useState("");
  const [sort, setSort] = useState<Sort>("urgency");
  const [pageSize, setPageSize] = usePageSize("pesito-stock-page-size", DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c = { out: 0, low: 0, ok: 0, excess: 0, negative: 0, nocost: 0, nomin: 0 };
    for (const r of rows) {
      c[r.status] += 1;
      if (r.stock < 0) c.negative += 1;
      if (r.cost === null || r.cost <= 0) c.nocost += 1;
      if (r.minStock <= 0) c.nomin += 1;
    }
    return c;
  }, [rows]);
  const restockCount = counts.out + counts.low;
  const slowCapital = slow.reduce((n, r) => n + r.capital, 0);

  const brands = useMemo(
    () => Array.from(new Set(rows.map((r) => r.brand).filter((x): x is string => Boolean(x)))).sort((x, y) => x.localeCompare(y)),
    [rows],
  );
  const suppliers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.supplier).filter((x): x is string => Boolean(x)))).sort((x, y) => x.localeCompare(y)),
    [rows],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (filter === "restock" && r.status !== "out" && r.status !== "low") return false;
      if ((filter === "out" || filter === "low" || filter === "ok" || filter === "excess") && r.status !== filter) return false;
      if (brand && r.brand !== brand) return false;
      if (supplier && r.supplier !== supplier) return false;
      if (q && !(r.name.toLowerCase().includes(q) || r.sku?.toLowerCase() === q || r.barcode?.toLowerCase() === q)) return false;
      return true;
    });
    // Por defecto lo que más urge primero: sin stock, por agotarse, y con Plan IA lo que menos dura.
    const order = { out: 0, low: 1, ok: 2, excess: 3 } as const;
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "stock") return a.stock - b.stock || a.name.localeCompare(b.name);
      if (sort === "value") return b.value - a.value || a.name.localeCompare(b.name);
      return (
        order[a.status] - order[b.status] ||
        (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
        a.stock - a.minStock - (b.stock - b.minStock) ||
        a.name.localeCompare(b.name)
      );
    });
  }, [rows, filter, query, brand, supplier, sort]);

  // Al cambiar de lista, buscar o filtrar se vuelve a la primera página.
  const listKey = `${filter}|${query}|${brand}|${supplier}|${sort}`;
  const [pageListKey, setPageListKey] = useState(listKey);
  if (pageListKey !== listKey) {
    setPageListKey(listKey);
    setPage(0);
  }
  const { safePage, start, end } = pageBounds(list.length, page, pageSize);

  function jump(next: Filter) {
    setFilter(next);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const total = rows.length || 1;
  const segments = (["ok", "low", "out", ...(insightsOn ? ["excess"] : [])] as StockStatus[]).filter((s) => counts[s] > 0);
  const chips: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Todos", count: rows.length },
    { value: "restock", label: "Para reponer", count: restockCount },
    { value: "out", label: "Sin stock", count: counts.out },
    { value: "low", label: "Por agotarse", count: counts.low },
    ...(insightsOn ? [{ value: "excess" as Filter, label: `Sin ventas ${idleDays} d`, count: counts.excess }] : []),
    { value: "ok", label: "OK", count: counts.ok },
  ];
  const listTitle =
    filter === "all"
      ? "Todos los productos"
      : filter === "restock"
        ? "Para reponer"
        : filter === "out"
          ? "Sin stock"
          : filter === "low"
            ? "Por agotarse"
            : filter === "ok"
              ? "OK"
              : `Sin ventas hace ${idleDays} días`;

  const exportScopes: ExportScope[] = [
    { id: "list", label: `Esta lista: ${listTitle.toLowerCase()}`, hint: "Con la búsqueda y los filtros de ahora", count: list.length, rows: () => list },
    { id: "all", label: "Todos los productos", count: rows.length, rows: () => rows },
  ];

  return (
    <div className="space-y-4">
      {/* Tres fichas de una línea: cada una lleva a la lista o a donde se corrige. */}
      <div className="grid gap-3 lg:grid-cols-3 [&>*]:min-w-0">
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
            restockCount > 0 ? "border-danger/30 bg-danger-bg/40" : "border-border bg-card"
          )}
        >
          <button
            type="button"
            disabled={restockCount === 0}
            onClick={() => jump("restock")}
            className="min-w-0 text-left"
            title="Ver en la lista lo que hay que reponer"
          >
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-danger" />
              Reponer ya
            </span>
            <span className={cn("block text-2xl font-bold", restockCount > 0 ? "text-danger" : "text-foreground")}>{restockCount}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {restockCount > 0 ? "sin stock o por agotarse" : "Nada por reponer"}
            </span>
          </button>
          {restockHref && restockCount > 0 && (
            <Link
              href={restockHref}
              prefetch={false}
              className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Qué comprar
            </Link>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-primary" />
              Capital parado
              {lockedPlan && <PlanPill plan={lockedPlan} />}
            </span>
            {!lockedPlan && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                sin ventas hace
                {/* El Select trae w-full y no se le puede achicar con className: va en un contenedor de ancho fijo. */}
                <span className="inline-block w-24">
                  <Select
                    value={idleDays}
                    disabled={idleLoading}
                    onChange={(e) => onIdleDaysChange(Number(e.target.value))}
                    aria-label="Días sin ventas"
                    className="h-7 rounded-lg px-2 py-0 text-xs"
                  >
                    {IDLE_DAYS_OPTIONS.map((d) => (
                      <option key={d} value={d}>{`${d} días`}</option>
                    ))}
                  </Select>
                </span>
              </label>
            )}
          </div>
          {lockedPlan ? (
            <>
              <p className="mt-1 text-sm text-foreground">Plata en mercadería con stock que no se vende.</p>
              <Link href={upgradeHref(lockedPlan)} prefetch={false} className="text-xs font-semibold text-primary hover:underline">
                {`Conocé el Plan ${planLabels[lockedPlan]}`}
              </Link>
            </>
          ) : (
            <button
              type="button"
              disabled={slow.length === 0}
              onClick={() => jump("excess")}
              className={cn("block text-left", idleLoading && "opacity-50")}
              title="Ver en la lista los productos sin ventas"
            >
              <span className="block text-2xl font-bold text-foreground">{idleLoading ? "…" : formatCurrency(slowCapital)}</span>
              <span className="block text-xs text-muted-foreground">
                {idleLoading ? "Calculando…" : slow.length === 0 ? `Nada parado en ${idleDays} días` : `${slow.length} producto${slow.length === 1 ? "" : "s"}`}
              </span>
            </button>
          )}
          {idleError && <p className="mt-1 rounded-lg bg-danger-bg px-2.5 py-1 text-xs text-danger">{idleError}</p>}
        </div>

        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wrench className="h-3.5 w-3.5 text-primary" />
            Revisar números
          </span>
          {counts.negative + counts.nocost + counts.nomin === 0 ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-success">
              <CircleCheck className="h-4 w-4" />
              Todo en orden
            </p>
          ) : (
            <>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(
                  [
                    ["negativo", "con stock negativo", counts.negative],
                    ["sin-costo", "sin costo", counts.nocost],
                    ["sin-minimo", "sin mínimo", counts.nomin],
                  ] as const
                )
                  .filter(([, , n]) => n > 0)
                  .map(([estado, label, n]) => (
                    <Link
                      key={estado}
                      href={`/productos?estado=${estado}`}
                      prefetch={false}
                      className="inline-flex items-center gap-0.5 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning hover:opacity-80"
                    >
                      {`${n} ${label}`}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Te llevan a Productos para corregirlos</p>
            </>
          )}
        </div>
      </div>

      {/* La lista: una sola tarjeta con buscador, filtros, chips por estado, barra de salud y tabla. */}
      <div ref={listRef} className="scroll-mt-20">
        <Card>
          <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, SKU o código…" className="pl-10" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Marca" className="sm:w-36">
                <option value="">Marca</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
              <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Proveedor" className="sm:w-40">
                <option value="">Proveedor</option>
                {suppliers.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar" className="sm:w-36">
                <option value="urgency">Más urgentes</option>
                <option value="name">Nombre</option>
                <option value="stock">Menor stock</option>
                <option value="value">Mayor valor</option>
              </Select>
              <Button
                type="button"
                variant="outline"
                disabled={rows.length === 0}
                onClick={() => setExportOpen(true)}
                title="Elegí qué productos y qué columnas bajar"
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>

          <div className="space-y-2.5 px-4 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFilter(c.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    filter === c.value ? "border-primary bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {`${c.label} · ${c.count}`}
                </button>
              ))}
              {!insightsOn && lockedPlan && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-500/40 px-3 py-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3 text-amber-600" />
                  Sin ventas y días que alcanza
                  <PlanPill plan={lockedPlan} />
                </span>
              )}
              <Link href="/productos" prefetch={false} className="ml-auto text-xs font-medium text-primary hover:underline">
                Ir al catálogo (Productos) →
              </Link>
            </div>
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {segments.map((s) => (
                <i key={s} className={cn("block h-full", segmentColor[s])} style={{ width: `${(counts[s] / total) * 100}%` }} />
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
              {filter === "excess" ? `Ningún producto con stock estuvo ${idleDays} días sin venderse.` : "No hay productos con esos filtros."}
            </p>
          ) : (
            <div className="relative overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Producto</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">Proveedor</th>
                    <th className="px-3 py-2.5 text-right">Stock</th>
                    <th className="hidden px-3 py-2.5 text-right sm:table-cell">Mín.</th>
                    {insightsOn && <th className="hidden px-3 py-2.5 text-right md:table-cell">Alcanza para</th>}
                    <th className="hidden px-3 py-2.5 sm:table-cell">Estado</th>
                    <th className="hidden px-3 py-2.5 text-right lg:table-cell">Valor</th>
                    <th className="px-3 py-2.5"><span className="sr-only">Acción</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.slice(start, end).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="max-w-[8rem] py-2.5 pl-3 pr-1 sm:max-w-[16rem] sm:px-4">
                        <p className="truncate font-medium text-foreground">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{[r.brand, r.sku ? `SKU ${r.sku}` : null].filter(Boolean).join(" · ") || "\u00a0"}</p>
                      </td>
                      <td className="hidden max-w-[10rem] truncate px-3 py-2.5 text-muted-foreground lg:table-cell">{r.supplier ?? "—"}</td>
                      <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-semibold", r.status === "out" ? "text-danger" : r.status === "low" ? "text-warning" : "text-foreground")}>
                        {`${qty(r.stock)}${r.unit}`}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground sm:table-cell">{`${qty(r.minStock)}${r.unit}`}</td>
                      {insightsOn && (
                        <td className={cn("hidden whitespace-nowrap px-3 py-2.5 text-right md:table-cell", r.daysLeft !== null && r.daysLeft !== undefined && r.daysLeft < 3 ? "font-semibold text-danger" : "text-muted-foreground")}>
                          {daysLabel(r.daysLeft)}
                        </td>
                      )}
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", statusTone[r.status])}>{statusLabel[r.status]}</span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground lg:table-cell">{formatCurrency(r.value)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                          {(r.status === "out" || r.status === "low") && (
                            <Link
                              href={`/compras?producto=${r.id}`}
                              prefetch={false}
                              aria-label={`Comprar ${r.name}`}
                              title="Comprar"
                              className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:px-2.5"
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Comprar</span>
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => onAdjust(r.id)}
                            aria-label={`Ajustar el stock de ${r.name}`}
                            title="Ajustar stock"
                            className="inline-flex h-8 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:w-8"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(r.id)}
                            aria-label={`Editar ${r.name}`}
                            title="Editar producto"
                            className="inline-flex h-8 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:w-8"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar
            total={list.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={(n) => {
              setPage(n);
              listRef.current?.scrollIntoView({ block: "start" });
            }}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(0);
            }}
          />
        </Card>
      </div>
      <ExcelExportDialog open={exportOpen} onClose={() => setExportOpen(false)} scopes={exportScopes} withCover={insightsOn} />
    </div>
  );
}
