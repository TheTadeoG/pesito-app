"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  ListFilter,
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
import { deleteSupplier, setPurchaseDueDate } from "@/app/(dashboard)/proveedores/actions";
import { downloadDebtExcel } from "@/app/(dashboard)/proveedores/debt-excel";
import {
  agoLabel,
  debtSummary,
  nextPayment,
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

// Las pestañas son atajos del filtro por estado ("Filtrar").
const TABS: { key: string; label: string; estados: EstadoKey[] }[] = [
  { key: "debt", label: "Con deuda", estados: WITH_DEBT },
  { key: "all", label: "Todos", estados: [] },
  { key: "al_dia", label: "Al día", estados: ["al_dia"] },
];

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
  const [paying, setPaying] = useState<{ row: SupplierRow; purchaseId: string | null } | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const allItems = useMemo(() => rows.flatMap((r) => r.items), [rows]);
  const totals = useMemo(() => totalsOf(allItems), [allItems]);
  const upcoming = useMemo(() => nextDue(allItems), [allItems]);
  const debtors = useMemo(
    () => rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance),
    [rows]
  );
  const pickerDebtors = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return q ? debtors.filter((d) => d.name.toLowerCase().includes(q)) : debtors;
  }, [debtors, pickerQuery]);
  const debtorsCount = rows.filter((r) => r.items.length > 0).length;
  const overdueSuppliers = useMemo(
    () => rows.filter((r) => hasStatus(r.items, "vencida")),
    [rows]
  );

  // Cuánto de la deuda es de cada proveedor (los 5 que más, y el resto junto).
  const debtShare = useMemo<DebtShareRow[]>(() => {
    const perSupplier = rows
      .filter((r) => r.items.length > 0)
      .map((r) => {
        const t = totalsOf(r.items);
        return { id: r.id, name: r.name, total: t.total, vencida: t.vencida, pronto: t.pronto, no_vencida: t.no_vencida, sin_fecha: t.sin_fecha };
      })
      .sort((a, b) => b.total - a.total);
    const top = perSupplier.slice(0, 5);
    const rest = perSupplier.slice(5);
    if (rest.length > 0) {
      top.push({
        id: "otros",
        name: `Otros (${rest.length})`,
        total: rest.reduce((acc, r) => acc + r.total, 0),
        vencida: rest.reduce((acc, r) => acc + r.vencida, 0),
        pronto: rest.reduce((acc, r) => acc + r.pronto, 0),
        no_vencida: rest.reduce((acc, r) => acc + r.no_vencida, 0),
        sin_fecha: rest.reduce((acc, r) => acc + r.sin_fecha, 0),
      });
    }
    return top;
  }, [rows]);

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
    if (debtors.length === 1) setPaying({ row: debtors[0], purchaseId: null });
    else {
      setPickerQuery("");
      setPickerOpen(true);
    }
  }

  function toggleOpen(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Tocar el título de una columna ordena; tocarlo de nuevo invierte el orden.
  function sortBy(key: SortKey, firstDir: SortDir) {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDir }));
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
    ? "lg:grid-cols-[minmax(0,1.5fr)_8rem_minmax(0,1.6fr)_7rem_9.5rem]"
    : "lg:grid-cols-[minmax(0,1.6fr)_7rem_8rem_9.5rem]";

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
              {accountsEnabled
                ? "Cuánto le debés a cada uno · a quién le comprás más"
                : "A quién le comprás más"}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground">
            {statsOpen ? "Ocultar" : "Ver"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", statsOpen && "rotate-180")} />
          </span>
        </button>
        {statsOpen && (
          <div className={cn("grid gap-3 bg-muted/30 p-4", accountsEnabled && "lg:grid-cols-2")}>
            {accountsEnabled && (
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm font-semibold text-foreground">Cuánto le debés a cada uno</p>
                  <p className="text-xs text-muted-foreground">
                    {`Total que les debés · ${formatCurrency(totals.total)}`}
                  </p>
                  <DebtShare rows={debtShare} total={totals.total} />
                </CardContent>
              </Card>
            )}
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
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            {accountsEnabled && (
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
                    {`${t.label} ${counts[t.key]}`}
                  </button>
                ))}
              </div>
            )}
            {accountsEnabled && (
              <FilterPanel
                trigger={
                  <span
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-muted",
                      !activeTab && estados.size > 0 ? "bg-accent text-accent-foreground" : "text-foreground"
                    )}
                  >
                    <ListFilter className="h-3.5 w-3.5" />
                    Filtrar
                  </span>
                }
              >
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Mostrar proveedores con…</p>
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
            )}
            {accountsEnabled && debtors.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-9 px-0"
                onClick={() => downloadDebtExcel(rows, todayKey)}
                title="Descargar la deuda en Excel"
                aria-label="Descargar la deuda en Excel"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>

          {accountsEnabled && !activeTab && estados.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 font-semibold text-accent-foreground">
                {`Estado: ${Array.from(estados)
                  .map((e) => ESTADO_LABEL[e].replace(/ \(.*\)/, ""))
                  .join(", ")}`}
                <button type="button" aria-label="Quitar el filtro de estado" onClick={() => setEstados(new Set())}>
                  <X className="h-3 w-3" />
                </button>
              </span>
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
                <SortHeader label="Proveedor" active={sort.key === "name"} dir={sort.dir} onClick={() => sortBy("name", "asc")} />
                {accountsEnabled ? (
                  <>
                    <SortHeader label="Le debés" active={sort.key === "debt"} dir={sort.dir} onClick={() => sortBy("debt", "desc")} />
                    <SortHeader label="Próximo pago" active={sort.key === "urgency"} dir={sort.dir} onClick={() => sortBy("urgency", "asc")} />
                    <SortHeader label="Última compra" active={sort.key === "last"} dir={sort.dir} onClick={() => sortBy("last", "desc")} />
                  </>
                ) : (
                  <>
                    <SortHeader label="Última compra" active={sort.key === "last"} dir={sort.dir} onClick={() => sortBy("last", "desc")} />
                    <span>Total comprado</span>
                  </>
                )}
                <span />
              </div>
              {filtered.map((s) => {
                const next = nextPayment(s.items);
                const owes = s.balance > 0;
                const credit = s.balance < -0.004;
                const whatsapp = chatWhatsappUrl(s.phone);
                const expanded = accountsEnabled && owes && open.has(s.id);
                return (
                  <div key={s.id}>
                    <div
                      className={cn(
                        "group grid gap-1.5 px-4 py-2.5 hover:bg-muted/30 lg:items-center lg:gap-3",
                        gridCols
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        {accountsEnabled && owes ? (
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={expanded ? `Ocultar las compras de ${s.name}` : `Ver las compras que le debés a ${s.name}`}
                            onClick={() => toggleOpen(s.id)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          >
                            <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
                          </button>
                        ) : (
                          <span className="h-7 w-7 shrink-0" />
                        )}
                        <Link
                          href={`/proveedores/${s.id}`}
                          title="Ver ficha del proveedor"
                          className="min-w-0 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-muted"
                        >
                          <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                          {(s.phone || s.email) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {[s.phone, s.email].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </Link>
                      </div>

                      {accountsEnabled ? (
                        <>
                          <p className="text-sm">
                            {owes ? (
                              <span className="text-base font-bold text-foreground">{formatCurrency(s.balance)}</span>
                            ) : credit ? (
                              <span className="font-semibold text-success">{`A tu favor ${formatCurrency(-s.balance)}`}</span>
                            ) : (
                              <span className="text-muted-foreground">Al día</span>
                            )}
                          </p>
                          <p className="min-w-0 truncate text-sm">
                            {next ? (
                              <>
                                <span className="font-semibold text-foreground">{formatCurrency(next.amount)}</span>
                                <span className="text-muted-foreground">{" · "}</span>
                                <span className={cn("font-medium", TONE_TEXT[next.tone])}>
                                  {next.more > 0 ? `${next.when} (+${next.more} más)` : next.when}
                                </span>
                              </>
                            ) : (
                              <span className="hidden text-muted-foreground lg:inline">—</span>
                            )}
                          </p>
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

                      <div className="flex items-center gap-1.5 lg:justify-end">
                        {whatsapp && (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Escribirle a ${s.name} por WhatsApp`}
                            title="Escribirle por WhatsApp"
                            className="lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
                          >
                            <Button size="sm" variant="ghost" className="w-8 px-0" tabIndex={-1}>
                              <MessageCircle className="h-4 w-4 shrink-0" />
                            </Button>
                          </a>
                        )}
                        {accountsEnabled && owes ? (
                          <Button size="sm" onClick={() => setPaying({ row: s, purchaseId: null })}>
                            Pagar
                          </Button>
                        ) : (
                          <Link href="/compras">
                            <Button
                              size="sm"
                              variant="outline"
                              className="lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
                            >
                              Cargar compra
                            </Button>
                          </Link>
                        )}
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
                    {expanded && (
                      <div className="divide-y divide-border border-t border-border bg-muted/30 pl-4 lg:pl-14">
                        {s.items.map((item, idx) => (
                          <ItemRow
                            key={item.purchaseId ?? `adj-${idx}`}
                            item={item}
                            onPay={() => setPaying({ row: s, purchaseId: item.purchaseId })}
                          />
                        ))}
                      </div>
                    )}
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
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            placeholder="Buscar proveedor…"
            aria-label="Buscar proveedor para pagarle"
            autoFocus
            className="pl-10"
          />
        </div>
        <div className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {pickerDebtors.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No hay proveedores con deuda que coincidan.
            </p>
          )}
          {pickerDebtors.map((s) => {
            const summary = debtSummary(s.items);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setPaying({ row: s, purchaseId: null });
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
        supplier={paying?.row ?? null}
        items={paying?.row.items}
        initialPurchaseId={paying?.purchaseId ?? null}
        onClose={() => setPaying(null)}
        customPaymentMethods={customPaymentMethods}
      />
    </div>
  );
}

/** Título de columna: se toca para ordenar. */
function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-left transition-colors hover:text-foreground",
        active && "font-semibold text-foreground"
      )}
    >
      {label}
      {active && <Arrow className="h-3 w-3" />}
    </button>
  );
}

/** Una compra que se debe, dentro de la fila desplegada del proveedor. */
function ItemRow({ item, onPay }: { item: DebtItem; onPay: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(item.dueDate ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = item.purchaseId ? `Compra del ${shortDate(item.purchaseDay)}` : "Saldo sin compra asociada";
  const when =
    item.daysToDue === null || !item.dueDate
      ? { text: "sin fecha", tone: "muted" as const }
      : item.daysToDue < 0
        ? { text: `vencida hace ${-item.daysToDue} ${item.daysToDue === -1 ? "día" : "días"}`, tone: "danger" as const }
        : item.daysToDue === 0
          ? { text: "vence hoy", tone: "warning" as const }
          : item.daysToDue === 1
            ? { text: "vence mañana", tone: "warning" as const }
            : { text: `vence el ${shortDate(item.dueDate)}`, tone: item.status === "pronto" ? ("warning" as const) : ("muted" as const) };

  async function save() {
    if (!item.purchaseId || !date) return;
    setPending(true);
    setError(null);
    const result = await setPurchaseDueDate(item.purchaseId, date);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2 pr-4">
      <div className="min-w-0 flex-1 basis-44">
        <p className="truncate text-sm text-foreground">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground">{" · "}</span>
          <span className="font-semibold">{formatCurrency(item.amount)}</span>
        </p>
        <p className={cn("text-xs font-medium", TONE_TEXT[when.tone])}>{when.text}</p>
      </div>
      {item.purchaseId && (
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <div className="w-40">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="Fecha de vencimiento"
                  className="h-8 text-sm"
                />
              </div>
              <Button size="sm" disabled={pending || !date} onClick={save}>
                {pending ? "…" : "Guardar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {item.dueDate ? "Cambiar fecha" : "Asignar fecha"}
              </button>
              <Button size="sm" variant="outline" onClick={onPay}>
                Pagar esta
              </Button>
            </>
          )}
        </div>
      )}
      {error && <p className="basis-full text-xs text-danger">{error}</p>}
    </div>
  );
}

interface DebtShareRow {
  id: string;
  name: string;
  total: number;
  vencida: number;
  pronto: number;
  no_vencida: number;
  sin_fecha: number;
}

const SHARE_SEGMENTS = [
  { key: "vencida", label: "vencida", bar: "bg-danger" },
  { key: "pronto", label: "vence pronto", bar: "bg-warning" },
  { key: "no_vencida", label: "no vencida", bar: "bg-success" },
  { key: "sin_fecha", label: "sin fecha", bar: "bg-muted-foreground/50" },
] as const;

/** Qué parte de la deuda es de cada proveedor, con el estado de cada parte. */
function DebtShare({ rows, total }: { rows: DebtShareRow[]; total: number }) {
  if (total <= 0 || rows.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">No les debés nada a tus proveedores.</p>;
  }
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div className="mt-2 space-y-2.5">
      {rows.map((r) => (
        <div key={r.id}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-foreground">{r.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {`${Math.round((r.total / total) * 100)}% · ${formatCurrency(r.total)}`}
            </span>
          </div>
          <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="flex h-full gap-px" style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }}>
              {SHARE_SEGMENTS.filter((seg) => r[seg.key] > 0).map((seg) => (
                <div
                  key={seg.key}
                  className={cn("h-full", seg.bar)}
                  style={{ width: `${(r[seg.key] / r.total) * 100}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
        {SHARE_SEGMENTS.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1.5">
            <i className={cn("inline-block h-2 w-2 rounded-sm", seg.bar)} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
