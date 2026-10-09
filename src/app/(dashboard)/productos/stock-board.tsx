"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, CircleCheck, Download, Lock, Pencil, Search, ShoppingCart, SlidersHorizontal, TrendingDown, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PlanLockNote, PlanPill } from "@/components/dashboard/pro-locked-card";
import { cn, formatCurrency } from "@/lib/utils";
import { planLabels, type Plan } from "@/lib/subscription";
import { IDLE_DAYS_OPTIONS } from "@/lib/idle-days";
import { ExcelExportDialog, type ExportScope } from "@/app/(dashboard)/productos/excel-export-dialog";
import type { StockRow, StockStatus } from "@/lib/stock-rows";

// "restock" = sin stock + por agotarse (lo que hay que reponer). "all" = todos los productos.
type Filter = "all" | "restock" | "out" | "low" | "ok" | "excess";
type Sort = "urgency" | "name" | "stock" | "value";

const PAGE = 30;

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
 * Pestaña Stock: lo que hay que hacer. Tarjetas (reponer, capital parado, revisar números), la barra
 * de salud y una lista corta de excepciones. Para ver o corregir todo el catálogo, Productos.
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
  middle,
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
  /** Se muestra entre las tarjetas y la lista de excepciones. */
  middle?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [supplier, setSupplier] = useState("");
  const [sort, setSort] = useState<Sort>("urgency");
  const [limit, setLimit] = useState({ key: "", n: PAGE });
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

  const listKey = `${filter}|${query}|${brand}|${supplier}|${sort}`;
  const shown = limit.key === listKey ? limit.n : PAGE;

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
    <div className="space-y-5">
      {/* Tres tarjetas con lo que hay que hacer hoy. */}
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className={restockCount > 0 ? "border-danger/30 bg-danger-bg/40" : undefined}>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  Reponer ya
                  {restockCount > 0 && (
                    <span className="rounded-full bg-danger-bg px-2 text-xs font-semibold text-danger">{restockCount}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Sin stock o bajo el mínimo, lo que más falta primero</p>
              </div>
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
            {restockCount === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Ningún producto está por debajo de su mínimo.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows
                  .filter((r) => r.status === "out" || r.status === "low")
                  .sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock))
                  .slice(0, 3)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="min-w-0 truncate text-foreground">{r.name}</span>
                      <span className="shrink-0 font-medium text-danger">{`${qty(r.stock)} / ${qty(r.minStock)}`}</span>
                    </li>
                  ))}
              </ul>
            )}
            {restockCount > 3 && (
              <button type="button" onClick={() => jump("restock")} className="text-sm font-medium text-primary hover:underline">
                {`Ver los ${restockCount} en la lista`}
              </button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingDown className="h-4 w-4 text-primary" />
                Capital parado
                {insightsOn && slowCapital > 0 && (
                  <span className="rounded-full bg-accent px-2 text-xs font-semibold text-accent-foreground">
                    {formatCurrency(slowCapital)}
                  </span>
                )}
                {lockedPlan && <PlanPill plan={lockedPlan} />}
              </p>
              {lockedPlan ? (
                <p className="text-xs text-muted-foreground">Plata en mercadería con stock que no se vende</p>
              ) : (
                <label className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  Con stock y sin ventas hace
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
                  {idleLoading && <span>Calculando…</span>}
                </label>
              )}
            </div>
            {lockedPlan ? (
              <PlanLockNote plan={lockedPlan}>
                {`Con el Plan ${planLabels[lockedPlan]} ves qué productos no se venden y cuánta plata tenés parada en ellos.`}
              </PlanLockNote>
            ) : (
              <div className={cn(idleLoading && "opacity-50")}>
                {idleError && <p className="rounded-lg bg-danger-bg px-2.5 py-1.5 text-xs text-danger">{idleError}</p>}
                {slow.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">{`Nada parado: todo lo que tenés con stock se vendió en los últimos ${idleDays} días.`}</p>
                ) : (
                  <>
                    <ul className="divide-y divide-border">
                      {slow.slice(0, 3).map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                          <span className="min-w-0 truncate text-foreground">{r.name}</span>
                          <span className="shrink-0 font-medium text-foreground">{formatCurrency(r.capital)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                      <button type="button" onClick={() => jump("excess")} className="text-sm font-medium text-primary hover:underline">
                        {`Ver los ${slow.length} en la lista`}
                      </button>
                      <Link href="/baja-rotacion" prefetch={false} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                        Baja rotación
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wrench className="h-4 w-4 text-primary" />
                Revisar números
              </p>
              <p className="text-xs text-muted-foreground">Tocá uno: te lleva a Productos ya filtrado, para corregirlos</p>
            </div>
            <ul className="space-y-1.5">
              {(
                [
                  ["negativo", "Con stock negativo", "Falta cargar una compra o un ajuste", counts.negative],
                  ["sin-costo", "Sin costo cargado", "El valor del stock queda por debajo del real", counts.nocost],
                  ["sin-minimo", "Sin stock mínimo", "No te avisamos cuando se acabe", counts.nomin],
                ] as const
              ).map(([estado, label, hint, n]) => {
                const inner = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{n === 0 ? "Todo en orden" : hint}</span>
                    </span>
                    {n === 0 ? (
                      <CircleCheck className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <>
                        <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-sm font-semibold text-warning">{n}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </>
                    )}
                  </>
                );
                return (
                  <li key={estado}>
                    {n === 0 ? (
                      <div className="flex items-center gap-3 rounded-xl px-3 py-2">{inner}</div>
                    ) : (
                      <Link
                        href={`/productos?estado=${estado}`}
                        prefetch={false}
                        className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted"
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {middle}

      {/* Salud del stock + lista de excepciones. */}
      <div ref={listRef} className="scroll-mt-20 space-y-3">
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Salud del stock</p>
              <div className="flex items-center gap-3">
                <p className="hidden text-xs text-muted-foreground sm:block">{`${rows.length} producto${rows.length === 1 ? "" : "s"} en total`}</p>
                <Link
                  href="/productos"
                  prefetch={false}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ir al catálogo (Productos) →
                </Link>
              </div>
            </div>
            <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {segments.map((s) => (
                <i key={s} className={cn("block h-full", segmentColor[s])} style={{ width: `${(counts[s] / total) * 100}%` }} />
              ))}
            </div>
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
                  Productos sin ventas y días que alcanza
                  <PlanPill plan={lockedPlan} />
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {listTitle}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {`${list.length}${sort === "urgency" ? " · lo que más urge primero" : ""}`}
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => setExportOpen(true)}
              title="Elegí qué productos y qué columnas bajar"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar Excel
            </Button>
          </div>
          <div className="flex flex-col gap-2 border-b border-border px-4 pb-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, SKU o código…" className="pl-10" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Marca" className="sm:w-40">
                <option value="">Marca</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
              <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Proveedor" className="sm:w-44">
                <option value="">Proveedor</option>
                {suppliers.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar" className="col-span-2 sm:col-span-1 sm:w-40">
                <option value="urgency">Más urgentes</option>
                <option value="name">Nombre</option>
                <option value="stock">Menor stock</option>
                <option value="value">Mayor valor</option>
              </Select>
            </div>
          </div>

          {list.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {filter === "excess" ? `Ningún producto con stock estuvo ${idleDays} días sin venderse.` : "No hay productos con esos filtros."}
            </p>
          ) : (
            <div className="relative overflow-x-auto">
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
                  {list.slice(0, shown).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="max-w-[8rem] py-2.5 pl-3 pr-1 sm:max-w-[16rem] sm:px-4">
                        <p className="truncate font-medium text-foreground">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{[r.brand, r.sku ? `SKU ${r.sku}` : null].filter(Boolean).join(" · ") || " "}</p>
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
          {list.length > shown && (
            <button
              type="button"
              onClick={() => setLimit({ key: listKey, n: shown + PAGE })}
              className="w-full border-t border-border px-5 py-3 text-center text-sm font-medium text-primary hover:bg-muted"
            >
              {`Ver más (${list.length - shown} restantes)`}
            </button>
          )}
        </Card>
      </div>
      <ExcelExportDialog open={exportOpen} onClose={() => setExportOpen(false)} scopes={exportScopes} withCover={insightsOn} />
    </div>
  );
}
