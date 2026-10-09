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
import { downloadStockExcel } from "@/app/(dashboard)/productos/stock-excel";

export type StockStatus = "out" | "low" | "ok" | "excess";

export interface StockRow {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  unit: string;
  stock: number;
  minStock: number;
  cost: number | null;
  price: number;
  supplier: string | null;
  status: StockStatus;
  /** Días que alcanza el stock (Plan IA): 0 sin stock, null si no se vendió en el período, undefined sin el plan. */
  daysLeft: number | null | undefined;
  /** Stock × costo. */
  value: number;
}

type Filter = "all" | StockStatus | "restock" | "negative" | "nocost" | "nomin";
type Sort = "urgency" | "name" | "value" | "stock";

const PAGE = 50;

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

function urgencyOf(r: StockRow): number {
  // Primero lo que falta (sin stock, por agotarse), después lo demás; con el Plan IA, lo que menos dura.
  const order = { out: 0, low: 1, ok: 2, excess: 3 }[r.status];
  return order;
}

/**
 * Número editable en la misma celda (costo o stock mínimo): tocás, escribís, Enter para guardar,
 * Esc para cancelar. Con `open` fijo (cuando se está corrigiendo justo ese dato) ya viene el campo.
 * Va dentro de un contenedor de ancho fijo: el Input trae w-full y no se achica con className.
 */
function InlineNumber({
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

export function StockBoard({
  rows,
  brands,
  suppliers,
  insightsOn,
  lockedPlan,
  slow,
  idleDays,
  idleLoading,
  idleError,
  onIdleDaysChange,
  restockHref,
  onQuickSave,
  onEdit,
  onAdjust,
}: {
  rows: StockRow[];
  brands: string[];
  suppliers: string[];
  /** Plan IA: se ven los días que alcanza el stock y el exceso. */
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
  /** Guarda el costo o el mínimo de un producto (devuelve el error, o null si salió bien). */
  onQuickSave: (id: string, field: "cost" | "minStock", value: number) => Promise<string | null>;
  onEdit: (id: string) => void;
  onAdjust: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [supplier, setSupplier] = useState("");
  const [sort, setSort] = useState<Sort>("urgency");
  const [limit, setLimit] = useState({ key: "", n: PAGE });
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c = { all: rows.length, out: 0, low: 0, ok: 0, excess: 0, negative: 0, nocost: 0, nomin: 0 };
    for (const r of rows) {
      c[r.status] += 1;
      if (r.stock < 0) c.negative += 1;
      if (r.cost === null || r.cost <= 0) c.nocost += 1;
      if (r.minStock <= 0) c.nomin += 1;
    }
    return c;
  }, [rows]);

  const needRestock = useMemo(
    () => rows.filter((r) => r.status === "out" || r.status === "low").sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock)),
    [rows]
  );
  const slowCapital = slow.reduce((n, r) => n + r.capital, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (filter === "negative" && r.stock >= 0) return false;
      if (filter === "restock" && r.status !== "out" && r.status !== "low") return false;
      if (filter === "nocost" && r.cost !== null && r.cost > 0) return false;
      if (filter === "nomin" && r.minStock > 0) return false;
      if ((filter === "out" || filter === "low" || filter === "ok" || filter === "excess") && r.status !== filter) return false;
      if (brand && r.brand !== brand) return false;
      if (supplier && r.supplier !== supplier) return false;
      if (q && !(r.name.toLowerCase().includes(q) || r.sku?.toLowerCase() === q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "value") return b.value - a.value;
      if (sort === "stock") return a.stock - b.stock || a.name.localeCompare(b.name);
      return (
        urgencyOf(a) - urgencyOf(b) ||
        (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
        a.stock - a.minStock - (b.stock - b.minStock) ||
        a.name.localeCompare(b.name)
      );
    });
  }, [rows, filter, query, brand, supplier, sort]);

  const key = `${filter}|${query}|${brand}|${supplier}|${sort}`;
  const shown = limit.key === key ? limit.n : PAGE;

  function jump(next: Filter) {
    setFilter(next);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const chips: { value: Filter; label: string; count: number; locked?: boolean }[] = [
    { value: "all", label: "Todos", count: counts.all },
    { value: "out", label: "Sin stock", count: counts.out },
    { value: "low", label: "Por agotarse", count: counts.low },
    { value: "ok", label: "OK", count: counts.ok },
    ...(insightsOn ? [{ value: "excess" as Filter, label: `Sin ventas ${idleDays} d`, count: counts.excess }] : []),
  ];

  const guide =
    filter === "nocost"
      ? "Escribí el costo en cada fila y apretá Enter. Con el costo, el valor del stock queda bien calculado."
      : filter === "nomin"
        ? "Escribí el stock mínimo en cada fila y apretá Enter: así Pesito te avisa cuando un producto se esté por acabar."
        : filter === "negative"
          ? "Con el botón de ajustes de cada fila (el de las barritas) dejás el stock en el número real."
          : null;

  const total = rows.length || 1;
  const segments = (["ok", "low", "out", ...(insightsOn ? ["excess"] : [])] as StockStatus[]).filter((s) => counts[s] > 0);

  return (
    <div className="space-y-5">
      {/* Tres tarjetas con lo que hay que hacer hoy. */}
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className={needRestock.length > 0 ? "border-danger/30 bg-danger-bg/40" : undefined}>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  Reponer ya
                  {needRestock.length > 0 && (
                    <span className="rounded-full bg-danger-bg px-2 text-xs font-semibold text-danger">{needRestock.length}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Sin stock o bajo el mínimo, lo que más falta primero</p>
              </div>
              {restockHref && needRestock.length > 0 && (
                <Link
                  href={restockHref}
                  prefetch={false}
                  className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Qué comprar
                </Link>
              )}
            </div>
            {needRestock.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Ningún producto está por debajo de su mínimo.</p>
            ) : (
              <ul className="divide-y divide-border">
                {needRestock.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-foreground">{r.name}</span>
                    <span className="shrink-0 font-medium text-danger">{`${qty(r.stock)} / ${qty(r.minStock)}`}</span>
                  </li>
                ))}
              </ul>
            )}
            {needRestock.length > 3 && (
              <button
                type="button"
                onClick={() => {
                  setSort("urgency");
                  jump("restock");
                }}
                className="text-sm font-medium text-primary hover:underline"
              >
                {`Ver los ${needRestock.length} en la tabla`}
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
                        {`Ver los ${slow.length} en la tabla`}
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
              <p className="text-xs text-muted-foreground">Tocá uno para ver esos productos en la tabla</p>
            </div>
            <ul className="space-y-1.5">
              {(
                [
                  ["negative", "Con stock negativo", "Falta cargar una compra o un ajuste", counts.negative],
                  ["nocost", "Sin costo cargado", "El valor del stock queda por debajo del real", counts.nocost],
                  ["nomin", "Sin stock mínimo", "No te avisamos cuando se acabe", counts.nomin],
                ] as const
              ).map(([value, label, hint, n]) => (
                <li key={value}>
                  <button
                    type="button"
                    disabled={n === 0}
                    onClick={() => jump(value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                      n === 0
                        ? "border-transparent"
                        : filter === value
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/50 hover:bg-muted"
                    )}
                  >
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
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Salud del stock + tabla maestra. */}
      <div ref={tableRef} className="scroll-mt-20 space-y-3">
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Salud del stock</p>
              <div className="flex items-center gap-3">
                <p className="hidden text-xs text-muted-foreground sm:block">{`${rows.length} producto${rows.length === 1 ? "" : "s"} en total`}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={filtered.length === 0 || exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await downloadStockExcel(filtered, insightsOn);
                    } finally {
                      setExporting(false);
                    }
                  }}
                  title="Baja a Excel la lista como la estás viendo (con los filtros y el orden elegidos)"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exporting ? "Preparando…" : `Descargar Excel (${filtered.length})`}
                </Button>
              </div>
            </div>
            <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {segments.map((s) => (
                <i key={s} className={cn("block h-full", segmentColor[s])} style={{ width: `${(counts[s] / total) * 100}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
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
              {(filter === "restock" || filter === "negative" || filter === "nocost" || filter === "nomin") && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="rounded-full border border-primary bg-accent px-3 py-1 text-xs font-medium text-foreground"
                >
                  {`Filtro: ${filter === "restock" ? "para reponer" : filter === "negative" ? "stock negativo" : filter === "nocost" ? "sin costo" : "sin mínimo"} ✕`}
                </button>
              )}
            </div>
            {guide && <p className="rounded-lg bg-accent px-3 py-2 text-sm text-foreground">{guide}</p>}
          </CardContent>
        </Card>

        <Card>
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o SKU…" className="pl-10" />
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
                {suppliers.map((s) => (
                  <option key={s} value={s}>{s}</option>
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

          {filtered.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay productos con esos filtros.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Producto</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">Proveedor</th>
                    <th className="px-3 py-2.5 text-right">Stock</th>
                    <th className="hidden px-3 py-2.5 text-right sm:table-cell">Mín.</th>
                    <th className="hidden px-3 py-2.5 text-right md:table-cell">Costo</th>
                    {insightsOn && <th className="hidden px-3 py-2.5 text-right md:table-cell">Alcanza para</th>}
                    <th className="hidden px-3 py-2.5 sm:table-cell">Estado</th>
                    <th className="hidden px-3 py-2.5 text-right lg:table-cell">Valor</th>
                    <th className="px-3 py-2.5"><span className="sr-only">Acción</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.slice(0, shown).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="max-w-[8rem] py-2.5 pl-3 pr-1 sm:max-w-[16rem] sm:px-4">
                        <p className="truncate font-medium text-foreground">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{[r.brand, r.sku ? `SKU ${r.sku}` : null].filter(Boolean).join(" · ") || " "}</p>
                      </td>
                      <td className="hidden max-w-[10rem] truncate px-3 py-2.5 text-muted-foreground lg:table-cell">{r.supplier ?? "—"}</td>
                      <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-semibold", r.status === "out" ? "text-danger" : r.status === "low" ? "text-warning" : "text-foreground")}>
                        {`${qty(r.stock)}${r.unit}`}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right sm:table-cell">
                        <InlineNumber
                          value={r.minStock}
                          display={`${qty(r.minStock)}${r.unit}`}
                          placeholder="Mínimo"
                          label={`stock mínimo de ${r.name}`}
                          open={filter === "nomin" && r.minStock <= 0}
                          onSave={(v) => onQuickSave(r.id, "minStock", v)}
                        />
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right md:table-cell">
                        <InlineNumber
                          value={r.cost}
                          display={r.cost !== null && r.cost > 0 ? formatCurrency(r.cost) : "Sin costo"}
                          placeholder="Costo"
                          label={`costo de ${r.name}`}
                          open={filter === "nocost" && (r.cost === null || r.cost <= 0)}
                          onSave={(v) => onQuickSave(r.id, "cost", v)}
                        />
                      </td>
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
          {filtered.length > shown && (
            <button
              type="button"
              onClick={() => setLimit({ key, n: shown + PAGE })}
              className="w-full border-t border-border px-5 py-3 text-center text-sm font-medium text-primary hover:bg-muted"
            >
              {`Ver más (${filtered.length - shown} restantes)`}
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
