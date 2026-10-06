"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  Filter,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem, FilterPanel } from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/utils";
import { chatWhatsappUrl } from "@/lib/whatsapp";
import type { Supplier } from "@/lib/types";
import { SOON_DAYS, nextDue, totalsOf, urgencyRank, type DebtItem } from "@/lib/supplier-debt";
import type { SupplierOverview, SupplierRow } from "@/lib/supplier-overview";
import { SupplierForm } from "@/app/(dashboard)/proveedores/supplier-form";
import { SupplierPaymentDialog } from "@/app/(dashboard)/proveedores/supplier-payment-dialog";
import { deleteSupplier } from "@/app/(dashboard)/proveedores/actions";
import { downloadDebtExcel } from "@/app/(dashboard)/proveedores/debt-excel";
import {
  agoLabel,
  debtSummary,
  shortDate,
  type DebtTone,
} from "@/app/(dashboard)/proveedores/debt-format";

type SortKey = "urgency" | "name" | "debt" | "last";
type SortDir = "asc" | "desc";
type EstadoKey = "vencida" | "pronto" | "no_vencida" | "sin_fecha" | "al_dia";
type Mode = "vencimiento" | "antiguedad";

const TONE_TEXT: Record<DebtTone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-muted-foreground",
};

const ESTADO_LABEL: Record<EstadoKey, string> = {
  vencida: "Vencida",
  pronto: `Vence pronto (${SOON_DAYS} días)`,
  no_vencida: "No vencida",
  sin_fecha: "Sin fecha",
  al_dia: "Al día (sin deuda)",
};

const WITH_DEBT: EstadoKey[] = ["vencida", "pronto", "no_vencida", "sin_fecha"];

// Las pestañas son atajos del filtro de la columna "Estado de la deuda".
const TABS: { key: string; label: string; estados: EstadoKey[] }[] = [
  { key: "debt", label: "Con deuda", estados: WITH_DEBT },
  { key: "all", label: "Todos", estados: [] },
  { key: "vencida", label: "Vencidas", estados: ["vencida"] },
  { key: "pronto", label: "Vencen pronto", estados: ["pronto"] },
  { key: "sin_fecha", label: "Sin fecha", estados: ["sin_fecha"] },
  { key: "al_dia", label: "Al día", estados: ["al_dia"] },
];

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

const hasStatus = (items: readonly DebtItem[], status: DebtItem["status"]) =>
  items.some((i) => i.status === status);

function matchesEstado(row: SupplierRow, estado: EstadoKey): boolean {
  return estado === "al_dia" ? row.items.length === 0 : hasStatus(row.items, estado);
}

function sameSet(a: ReadonlySet<EstadoKey>, b: readonly EstadoKey[]) {
  return a.size === b.length && b.every((k) => a.has(k));
}

export function ProveedoresClient({
  overview,
  customPaymentMethods = [],
  accountsEnabled,
}: {
  overview: SupplierOverview;
  customPaymentMethods?: string[];
  // Cuenta corriente con proveedores: Plan Esencial (lib/plan-access.ts).
  accountsEnabled: boolean;
}) {
  const { rows, todayKey } = overview;
  const router = useRouter();
  const hasDebtors = rows.some((r) => r.balance > 0);

  const [query, setQuery] = useState("");
  const [estados, setEstados] = useState<Set<EstadoKey>>(
    () => new Set(accountsEnabled && hasDebtors ? WITH_DEBT : [])
  );
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: accountsEnabled ? "urgency" : "name",
    dir: "asc",
  });
  const [mode, setMode] = useState<Mode>("vencimiento");
  const [statsOpen, setStatsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [paying, setPaying] = useState<SupplierRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const allItems = useMemo(() => rows.flatMap((r) => r.items), [rows]);
  const totals = useMemo(() => totalsOf(allItems), [allItems]);
  const upcoming = useMemo(() => nextDue(allItems), [allItems]);
  const debtors = useMemo(
    () => rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance),
    [rows]
  );
  const debtorsCount = rows.filter((r) => r.items.length > 0).length;
  const overdueSuppliers = useMemo(
    () => rows.filter((r) => hasStatus(r.items, "vencida")),
    [rows]
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const tab of TABS) {
      result[tab.key] =
        tab.estados.length === 0
          ? rows.length
          : rows.filter((r) => tab.estados.some((e) => matchesEstado(r, e))).length;
    }
    return result;
  }, [rows]);

  const activeTab = TABS.find((t) => sameSet(estados, t.estados))?.key ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((s) => {
      if (estados.size > 0 && !Array.from(estados).some((e) => matchesEstado(s, e))) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        Boolean(s.phone?.toLowerCase().includes(q)) ||
        Boolean(s.email?.toLowerCase().includes(q))
      );
    });
    const byName = (a: SupplierRow, b: SupplierRow) => a.name.localeCompare(b.name, "es");
    const firstDue = (r: SupplierRow) =>
      r.items.reduce((min, i) => (i.dueDate && i.dueDate < min ? i.dueDate : min), "9999-12-31");
    const compare = (a: SupplierRow, b: SupplierRow) => {
      if (sort.key === "name") return byName(a, b);
      if (sort.key === "debt") return a.balance - b.balance || byName(a, b);
      if (sort.key === "last") {
        return (a.lastPurchaseAt ?? "").localeCompare(b.lastPurchaseAt ?? "") || byName(a, b);
      }
      return (
        urgencyRank(a.items) - urgencyRank(b.items) ||
        firstDue(a).localeCompare(firstDue(b)) ||
        b.balance - a.balance ||
        byName(a, b)
      );
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => sign * compare(a, b));
  }, [rows, query, estados, sort]);

  async function handleDelete(supplier: Supplier) {
    if (!confirm(`¿Borrar a "${supplier.name}"?`)) return;
    setBusyId(supplier.id);
    await deleteSupplier(supplier.id);
    setBusyId(null);
  }

  // "Registrar pago" de la barra de arriba: con un solo deudor va directo, con
  // varios se elige a quién.
  function startPayment() {
    if (debtors.length === 1) setPaying(debtors[0]);
    else setPickerOpen(true);
  }

  function toggleEstado(key: EstadoKey) {
    setEstados((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const segments =
    mode === "vencimiento"
      ? [
          { key: "vencida", label: "vencida", value: totals.vencida, bar: "bg-danger", text: "text-danger" },
          {
            key: "pronto",
            label: "vence pronto",
            value: totals.pronto,
            bar: "bg-warning",
            text: "text-warning",
          },
          { key: "no_vencida", label: "no vencida", value: totals.no_vencida, bar: "bg-success", text: "text-success" },
          {
            key: "sin_fecha",
            label: "sin fecha",
            value: totals.sin_fecha,
            bar: "bg-muted-foreground/50",
            text: "text-muted-foreground",
          },
        ]
      : [
          { key: "h7", label: "hasta 7 días", value: totals.hasta7, bar: "bg-success", text: "text-success" },
          { key: "h30", label: "8 a 30 días", value: totals.de8a30, bar: "bg-warning", text: "text-warning" },
          { key: "m30", label: "más de 30 días", value: totals.mas30, bar: "bg-danger", text: "text-danger" },
        ];

  const gridCols = accountsEnabled
    ? "lg:grid-cols-[2.25rem_minmax(0,1.3fr)_6.5rem_minmax(0,2fr)_7rem_12.5rem_1.75rem]"
    : "lg:grid-cols-[2.25rem_minmax(0,1.6fr)_7rem_8rem_10rem_1.75rem]";

  const upcomingWhen = upcoming
    ? upcoming.daysToDue === 0
      ? "Hoy"
      : upcoming.daysToDue === 1
        ? "Mañana"
        : `En ${upcoming.daysToDue} días`
    : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o contacto…"
            aria-label="Buscar proveedor"
            className="pl-10"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:ml-auto">
          {accountsEnabled && (
            <Link href="/proveedores/calendario">
              <Button variant="outline" className="w-full">
                <CalendarDays className="h-4 w-4" />
                Calendario
              </Button>
            </Link>
          )}
          {accountsEnabled && debtors.length > 0 && (
            <Button variant="outline" onClick={startPayment}>
              <Wallet className="h-4 w-4" />
              Registrar pago
            </Button>
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </Button>
        </div>
      </div>

      {accountsEnabled ? (
        <Card>
          <CardContent className="grid gap-4 py-4 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-0">
            <div className="space-y-2.5 lg:pr-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Les debés en total</p>
                  <p className="text-3xl font-bold leading-tight text-warning">
                    {formatCurrency(totals.total)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div
                    className="flex rounded-lg bg-muted p-0.5 text-xs font-semibold"
                    role="group"
                    aria-label="Ver la deuda"
                  >
                    {(
                      [
                        ["vencimiento", "Por vencimiento"],
                        ["antiguedad", "Por antigüedad"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={mode === key}
                        onClick={() => setMode(key)}
                        className={cn(
                          "rounded-md px-2.5 py-1 transition-colors",
                          mode === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {`${debtorsCount} de ${rows.length} proveedores`}
                  </p>
                </div>
              </div>
              {totals.total > 0 ? (
                <>
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                    {segments
                      .filter((s) => s.value > 0)
                      .map((s) => (
                        <div
                          key={s.key}
                          className={cn("h-full", s.bar)}
                          style={{ width: `${(s.value / totals.total) * 100}%` }}
                        />
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {segments
                      .filter((s) => s.value > 0)
                      .map((s) => (
                        <span key={s.key} className="flex items-center gap-1.5">
                          <i className={cn("inline-block h-2 w-2 rounded-sm", s.bar)} />
                          <b className={cn("font-semibold", s.text)}>{formatCurrency(s.value)}</b>
                          {s.label}
                        </span>
                      ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No les debés nada a tus proveedores.</p>
              )}
            </div>

            {totals.vencida === 0 && !upcoming ? (
              <div className="border-border lg:col-span-2 lg:border-l lg:pl-6">
                <p className="text-sm font-semibold text-foreground">
                  {totals.total > 0 ? "Nada vencido" : "Todo al día"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {totals.sin_fecha > 0
                    ? "Asignale fecha a las compras sin vencimiento para ver cuánto vence pronto."
                    : "Cuando cargues una compra a cuenta con vencimiento, lo ves acá."}
                </p>
                {totals.sin_fecha > 0 && (
                  <Link
                    href="/proveedores/calendario"
                    className="mt-1.5 inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    Asignar fechas →
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="border-border lg:border-l lg:px-6">
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      totals.vencida > 0 ? "text-danger" : "text-muted-foreground"
                    )}
                  >
                    Vencidas · hay que pagar
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-2xl font-bold",
                      totals.vencida > 0 ? "text-danger" : "text-foreground"
                    )}
                  >
                    {formatCurrency(totals.vencida)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {overdueSuppliers.length === 0
                      ? "No tenés deudas vencidas."
                      : overdueSuppliers.length <= 2
                        ? overdueSuppliers.map((s) => s.name).join(" · ")
                        : `${overdueSuppliers
                            .slice(0, 2)
                            .map((s) => s.name)
                            .join(" · ")} y ${overdueSuppliers.length - 2} más`}
                  </p>
                </div>
                <div className="border-border lg:border-l lg:pl-6">
                  <p className="text-xs text-muted-foreground">Próximo vencimiento</p>
                  {upcoming ? (
                    <>
                      <p className="mt-0.5 text-2xl font-bold text-foreground">{upcomingWhen}</p>
                      <p className="text-xs text-muted-foreground">
                        {`${rows.find((r) => r.id === upcoming.supplierId)?.name ?? "Proveedor"} · ${formatCurrency(upcoming.amount)}${
                          upcoming.daysToDue !== null && upcoming.daysToDue > 1
                            ? ` · ${shortDate(upcoming.dueDate as string)}`
                            : ""
                        }`}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-0.5 text-2xl font-bold text-foreground">—</p>
                      <p className="text-xs text-muted-foreground">Sin vencimientos próximos.</p>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <PlanLockNote plan="esencial">
          Con el Plan Esencial llevás la cuenta corriente con cada proveedor: cuánto les debés, cuándo
          vence cada compra, pagos parciales y el calendario de vencimientos.
        </PlanLockNote>
      )}

      <Card>
        <button
          type="button"
          aria-expanded={statsOpen}
          onClick={() => setStatsOpen((v) => !v)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
            statsOpen && "border-b border-border"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <BarChart3 className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Estadísticas</span>
            <span className="block truncate text-xs text-muted-foreground">
              Compras y pagos por mes · a quién le comprás más
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground">
            {statsOpen ? "Ocultar" : "Ver"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", statsOpen && "rotate-180")} />
          </span>
        </button>
        {statsOpen && (
          <div className="grid gap-3 bg-muted/30 p-4 lg:grid-cols-2">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Compras y pagos por mes</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <i className="inline-block h-2 w-2 rounded-sm bg-primary" />
                      Compras
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="inline-block h-2 w-2 rounded-sm bg-primary/40" />
                      Pagos
                    </span>
                  </div>
                </div>
                <MonthlyBars data={overview.monthly} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-sm font-semibold text-foreground">A quién le comprás más</p>
                <p className="text-xs text-muted-foreground">
                  {`Últimos 30 días · ${formatCurrency(overview.topTotal)}`}
                </p>
                {overview.top.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Todavía no hay compras en este período.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2.5">
                    {overview.top.map((t) => (
                      <div key={t.name}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-foreground">{t.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {`${t.pct}% · ${formatCurrency(t.amount)}`}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${Math.max(3, t.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Card>

      <Card>
        <CardContent className="p-0">
          {accountsEnabled && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
              <div className="flex flex-1 flex-wrap gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={activeTab === t.key}
                    onClick={() => setEstados(new Set(t.estados))}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                      activeTab === t.key
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t.label}
                    <span className="ml-1.5 font-medium opacity-70">{counts[t.key]}</span>
                  </button>
                ))}
              </div>
              {debtors.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadDebtExcel(rows, todayKey)}
                  title="Baja la deuda, compra por compra, a una planilla de Excel"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar deuda (Excel)
                </Button>
              )}
            </div>
          )}

          {accountsEnabled && !activeTab && estados.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
              <span className="text-muted-foreground">Filtros:</span>
              <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 font-semibold text-accent-foreground">
                {`Estado: ${Array.from(estados)
                  .map((e) => ESTADO_LABEL[e].replace(/ \(.*\)/, ""))
                  .join(", ")}`}
                <button
                  type="button"
                  aria-label="Quitar el filtro de estado"
                  onClick={() => setEstados(new Set())}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
              <button
                type="button"
                onClick={() => setEstados(new Set())}
                className="font-semibold text-primary hover:underline"
              >
                Limpiar todo
              </button>
            </div>
          )}

          <div className="border-b border-border p-3 lg:hidden">
            <Select
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":") as [SortKey, SortDir];
                setSort({ key, dir });
              }}
              aria-label="Ordenar proveedores"
            >
              {accountsEnabled && <option value="urgency:asc">Ordenar por vencimiento</option>}
              {accountsEnabled && <option value="debt:desc">Mayor deuda primero</option>}
              <option value="name:asc">Ordenar por nombre</option>
              <option value="last:desc">Compra más reciente</option>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "Todavía no cargaste proveedores."
                : "No hay proveedores con esos filtros."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              <div
                className={cn(
                  "hidden items-center gap-3 bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground lg:grid",
                  gridCols
                )}
              >
                <span />
                <SortMenu
                  label="Proveedor"
                  active={sort.key === "name"}
                  onPick={(dir) => setSort({ key: "name", dir })}
                  options={[
                    ["asc", "De la A a la Z"],
                    ["desc", "De la Z a la A"],
                  ]}
                  dir={sort.dir}
                />
                {accountsEnabled ? (
                  <SortMenu
                    label="Le debés"
                    active={sort.key === "debt"}
                    onPick={(dir) => setSort({ key: "debt", dir })}
                    options={[
                      ["desc", "De mayor a menor"],
                      ["asc", "De menor a mayor"],
                    ]}
                    dir={sort.dir}
                  />
                ) : (
                  <SortMenu
                    label="Última compra"
                    active={sort.key === "last"}
                    onPick={(dir) => setSort({ key: "last", dir })}
                    options={[
                      ["desc", "La más reciente primero"],
                      ["asc", "La más vieja primero"],
                    ]}
                    dir={sort.dir}
                  />
                )}
                {accountsEnabled ? (
                  <FilterPanel
                    align="left"
                    trigger={
                      <HeaderButton active={estados.size > 0 && !activeTab} icon={Filter}>
                        Estado de la deuda
                      </HeaderButton>
                    }
                  >
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      Mostrar proveedores con…
                    </p>
                    <div className="space-y-0.5">
                      {(Object.keys(ESTADO_LABEL) as EstadoKey[]).map((key) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={estados.has(key)}
                            onChange={() => toggleEstado(key)}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                          />
                          <span className="flex-1 font-medium text-foreground">{ESTADO_LABEL[key]}</span>
                          <span className="text-xs text-muted-foreground">
                            {rows.filter((r) => matchesEstado(r, key)).length}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEstados(new Set())}
                      className="mt-2 text-xs font-semibold text-primary hover:underline"
                    >
                      Limpiar
                    </button>
                  </FilterPanel>
                ) : (
                  <span>Total comprado</span>
                )}
                {accountsEnabled ? (
                  <SortMenu
                    label="Última compra"
                    active={sort.key === "last"}
                    onPick={(dir) => setSort({ key: "last", dir })}
                    options={[
                      ["desc", "La más reciente primero"],
                      ["asc", "La más vieja primero"],
                    ]}
                    dir={sort.dir}
                  />
                ) : null}
                <span />
                <span />
              </div>
              {filtered.map((s) => {
                const summary = debtSummary(s.items);
                const owes = s.balance > 0;
                const whatsapp = chatWhatsappUrl(s.phone);
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "group grid gap-2 px-4 py-2.5 hover:bg-muted/30 lg:items-center lg:gap-3",
                      gridCols
                    )}
                  >
                    <div
                      className={cn(
                        "hidden h-9 w-9 items-center justify-center rounded-xl text-xs font-bold lg:flex",
                        owes ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {initialsOf(s.name)}
                    </div>
                    <Link
                      href={`/proveedores/${s.id}`}
                      title="Ver ficha del proveedor"
                      className="-mx-2 min-w-0 rounded-lg px-2 py-0.5 transition-colors hover:bg-muted"
                    >
                      <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                      {(s.phone || s.email) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {[s.phone, s.email].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </Link>

                    {accountsEnabled ? (
                      <>
                        <p className="text-sm">
                          {owes ? (
                            <span className="text-base font-bold text-warning">
                              {formatCurrency(s.balance)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Al día</span>
                          )}
                        </p>
                        <div className="min-w-0">
                          {summary ? (
                            <>
                              <p
                                className={cn(
                                  "truncate text-sm font-semibold",
                                  TONE_TEXT[summary.tone]
                                )}
                              >
                                {summary.headline}
                              </p>
                              {summary.sub && (
                                <p className="truncate text-xs text-muted-foreground">{summary.sub}</p>
                              )}
                            </>
                          ) : (
                            <span className="hidden text-sm text-muted-foreground lg:inline">—</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="lg:hidden">Última compra: </span>
                          {agoLabel(s.lastPurchaseAt, todayKey)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          <span className="lg:hidden">Última compra: </span>
                          {agoLabel(s.lastPurchaseAt, todayKey)}
                        </p>
                        <p className="text-sm text-foreground">
                          <span className="text-muted-foreground lg:hidden">Total comprado: </span>
                          {formatCurrency(s.totalPurchased)}
                        </p>
                      </>
                    )}

                    <div
                      className={cn(
                        "flex items-center gap-1.5 lg:justify-end",
                        !(accountsEnabled && owes) &&
                          "lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
                      )}
                    >
                      {whatsapp && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Escribirle a ${s.name} por WhatsApp`}
                          title="Escribirle por WhatsApp"
                        >
                          <Button size="sm" variant="outline" className="w-8 px-0" tabIndex={-1}>
                            <MessageCircle className="h-4 w-4 shrink-0" />
                          </Button>
                        </a>
                      )}
                      {accountsEnabled && owes ? (
                        <Button size="sm" onClick={() => setPaying(s)}>
                          <Wallet className="h-3.5 w-3.5" />
                          Registrar pago
                        </Button>
                      ) : (
                        <Link href="/compras">
                          <Button size="sm" variant="outline">
                            Cargar compra
                          </Button>
                        </Link>
                      )}
                    </div>

                    <div className="flex justify-end lg:justify-center">
                      <DropdownMenu
                        trigger={
                          <button
                            type="button"
                            aria-label={`Más opciones de ${s.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      >
                        <DropdownMenuItem onClick={() => router.push(`/proveedores/${s.id}`)}>
                          Ver ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(s);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Editar datos
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          danger
                          disabled={busyId === s.id}
                          onClick={() => handleDelete(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Borrar proveedor
                        </DropdownMenuItem>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supplier={editing}
      />
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="¿A quién le pagás?"
        description="Elegí el proveedor al que le vas a registrar el pago."
      >
        <div className="divide-y divide-border rounded-xl border border-border">
          {debtors.map((s) => {
            const summary = debtSummary(s.items);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setPaying(s);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{s.name}</span>
                  {summary && (
                    <span className={cn("block truncate text-xs", TONE_TEXT[summary.tone])}>
                      {summary.headline}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-base font-bold text-warning">
                  {formatCurrency(s.balance)}
                </span>
              </button>
            );
          })}
        </div>
      </Dialog>
      <SupplierPaymentDialog
        supplier={paying}
        items={paying?.items}
        onClose={() => setPaying(null)}
        customPaymentMethods={customPaymentMethods}
      />
    </div>
  );
}

/** Título de columna que se puede tocar (orden o filtro). */
function HeaderButton({
  active,
  icon: Icon,
  children,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      className={cn(
        "-ml-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 transition-colors hover:bg-muted",
        active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"
      )}
    >
      {children}
      <Icon className="h-3 w-3" />
    </span>
  );
}

/** Título de columna con menú de orden. */
function SortMenu({
  label,
  active,
  dir,
  options,
  onPick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  options: [SortDir, string][];
  onPick: (dir: SortDir) => void;
}) {
  return (
    <DropdownMenu
      align="left"
      trigger={
        <HeaderButton active={active} icon={ArrowUpDown}>
          {label}
        </HeaderButton>
      }
    >
      {options.map(([value, text]) => (
        <DropdownMenuItem key={value} onClick={() => onPick(value)}>
          <span className={cn(active && dir === value && "font-semibold text-primary")}>
            {active && dir === value ? `✓ ${text}` : text}
          </span>
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  );
}

function MonthlyBars({ data }: { data: SupplierOverview["monthly"] }) {
  const W = 330;
  const H = 120;
  const padBottom = 18;
  const top = 4;
  const chartH = H - padBottom - top;
  const max = Math.max(1, ...data.flatMap((d) => [d.compras, d.pagos]));
  const groupW = W / data.length;
  const barW = groupW * 0.3;
  const empty = data.every((d) => d.compras === 0 && d.pagos === 0);

  return (
    <div className="mt-2">
      {empty ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Todavía no hay compras en los últimos 6 meses.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Compras y pagos a proveedores de los últimos 6 meses"
        >
          <line x1={0} x2={W} y1={top + chartH} y2={top + chartH} className="stroke-border" />
          {data.map((d, i) => {
            const x0 = i * groupW + groupW * 0.17;
            const hc = (d.compras / max) * chartH;
            const hp = (d.pagos / max) * chartH;
            return (
              <g key={`${d.label}-${i}`}>
                <title>{`${d.label}: compras ${formatCurrency(d.compras)} · pagos ${formatCurrency(d.pagos)}`}</title>
                <rect x={x0} y={top + chartH - hc} width={barW} height={hc} rx={3} className="fill-primary" />
                <rect
                  x={x0 + barW + 3}
                  y={top + chartH - hp}
                  width={barW}
                  height={hp}
                  rx={3}
                  className="fill-primary/40"
                />
                <text
                  x={x0 + barW}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-muted-foreground"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
