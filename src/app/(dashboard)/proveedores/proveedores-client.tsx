"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, MoreHorizontal, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { paymentLabels } from "@/lib/payment-labels";
import type { Supplier } from "@/lib/types";
import {
  SOON_DAYS,
  addDays,
  calendarEvents,
  dayKey,
  daysBetween,
  nextDue,
  totalsOf,
  urgencyRank,
  type DebtItem,
} from "@/lib/supplier-debt";
import type { SupplierOverview, SupplierRow } from "@/lib/supplier-overview";
import { SupplierForm } from "@/app/(dashboard)/proveedores/supplier-form";
import { SupplierPaymentDialog } from "@/app/(dashboard)/proveedores/supplier-payment-dialog";
import { deleteSupplier } from "@/app/(dashboard)/proveedores/actions";
import { agoLabel, debtSummary, shortDate, type DebtTone } from "@/app/(dashboard)/proveedores/debt-format";

type SortKey = "urgency" | "debt" | "name" | "last";
type TabKey = "all" | "vencida" | "pronto" | "sin_fecha" | "al_dia";
type Mode = "vencimiento" | "antiguedad";

const TONE_TEXT: Record<DebtTone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-muted-foreground",
};

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

const hasStatus = (items: readonly DebtItem[], status: DebtItem["status"]) =>
  items.some((i) => i.status === status);

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
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [sort, setSort] = useState<SortKey>(accountsEnabled ? "urgency" : "name");
  const [mode, setMode] = useState<Mode>("vencimiento");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const allItems = useMemo(() => rows.flatMap((r) => r.items), [rows]);
  const totals = useMemo(() => totalsOf(allItems), [allItems]);
  const debtors = useMemo(
    () => rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance),
    [rows]
  );
  const debtorsCount = rows.filter((r) => r.items.length > 0).length;
  const upcoming = useMemo(() => nextDue(allItems), [allItems]);
  const overdueSuppliers = useMemo(
    () => rows.filter((r) => hasStatus(r.items, "vencida")),
    [rows]
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      vencida: rows.filter((r) => hasStatus(r.items, "vencida")).length,
      pronto: rows.filter((r) => hasStatus(r.items, "pronto")).length,
      sin_fecha: rows.filter((r) => hasStatus(r.items, "sin_fecha")).length,
      al_dia: rows.filter((r) => r.items.length === 0).length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((s) => {
      if (tab === "vencida" && !hasStatus(s.items, "vencida")) return false;
      if (tab === "pronto" && !hasStatus(s.items, "pronto")) return false;
      if (tab === "sin_fecha" && !hasStatus(s.items, "sin_fecha")) return false;
      if (tab === "al_dia" && s.items.length > 0) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        Boolean(s.phone?.toLowerCase().includes(q)) ||
        Boolean(s.email?.toLowerCase().includes(q))
      );
    });
    const byName = (a: SupplierRow, b: SupplierRow) => a.name.localeCompare(b.name, "es");
    if (sort === "name") return list.sort(byName);
    if (sort === "debt") return list.sort((a, b) => b.balance - a.balance || byName(a, b));
    if (sort === "last") {
      return list.sort((a, b) => (b.lastPurchaseAt ?? "").localeCompare(a.lastPurchaseAt ?? ""));
    }
    // Por urgencia: lo vencido primero, después lo que vence antes.
    const firstDue = (r: SupplierRow) =>
      r.items.reduce((min, i) => (i.dueDate && i.dueDate < min ? i.dueDate : min), "9999-12-31");
    return list.sort(
      (a, b) =>
        urgencyRank(a.items) - urgencyRank(b.items) ||
        firstDue(a).localeCompare(firstDue(b)) ||
        b.balance - a.balance ||
        byName(a, b)
    );
  }, [rows, query, tab, sort]);

  // Calendario corto: lo que viene en los próximos 7 días.
  const events = useMemo(
    () =>
      calendarEvents(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          deliveryDays: r.delivery_days ?? [],
          items: r.items,
        })),
        todayKey,
        addDays(todayKey, 7)
      ).slice(0, 5),
    [rows, todayKey]
  );

  // "Registrar pago" de la barra de arriba: con un solo deudor va directo, con
  // varios se elige a quién.
  function startPayment() {
    if (debtors.length === 1) setPaying(debtors[0]);
    else setPickerOpen(true);
  }

  async function handleDelete(supplier: Supplier) {
    if (!confirm(`¿Borrar a "${supplier.name}"?`)) return;
    setBusyId(supplier.id);
    await deleteSupplier(supplier.id);
    setBusyId(null);
  }

  const segments =
    mode === "vencimiento"
      ? [
          { key: "vencida", label: "vencida", value: totals.vencida, bar: "bg-danger", text: "text-danger" },
          {
            key: "pronto",
            label: `vence pronto (${SOON_DAYS} días)`,
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "vencida", label: "Vencidas" },
    { key: "pronto", label: "Vencen pronto" },
    { key: "sin_fecha", label: "Sin fecha" },
    { key: "al_dia", label: "Al día" },
  ];

  const gridCols = accountsEnabled
    ? "lg:grid-cols-[2.25rem_minmax(0,1.2fr)_6.5rem_minmax(0,2fr)_6.5rem_9.5rem_1.75rem]"
    : "lg:grid-cols-[2.25rem_minmax(0,1.6fr)_7rem_8rem_9.5rem_1.75rem]";

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
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Ordenar proveedores"
          className="lg:w-52"
        >
          {accountsEnabled && <option value="urgency">Ordenar por vencimiento</option>}
          {accountsEnabled && <option value="debt">Mayor deuda primero</option>}
          <option value="name">Ordenar por nombre</option>
          <option value="last">Última compra</option>
        </Select>
        <div className="flex flex-col gap-2 sm:flex-row lg:ml-auto">
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
        <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr_1fr]">
          <Card>
            <CardContent className="space-y-2.5 py-4">
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
            </CardContent>
          </Card>

          <Card className={cn(totals.vencida > 0 && "border-danger/40 bg-danger-bg/30")}>
            <CardContent className="space-y-1 py-4">
              <p
                className={cn(
                  "text-xs font-semibold",
                  totals.vencida > 0 ? "text-danger" : "text-muted-foreground"
                )}
              >
                Vencidas · hay que pagar
              </p>
              <p className={cn("text-2xl font-bold", totals.vencida > 0 ? "text-danger" : "text-foreground")}>
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 py-4">
              <p className="text-xs text-muted-foreground">Próximo vencimiento</p>
              {upcoming ? (
                <>
                  <p className="text-2xl font-bold text-foreground">
                    {formatDate(`${upcoming.dueDate}T12:00:00-03:00`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {`${rows.find((r) => r.id === upcoming.supplierId)?.name ?? "Proveedor"} · ${formatCurrency(upcoming.amount)} · ${
                      upcoming.daysToDue === 0
                        ? "hoy"
                        : upcoming.daysToDue === 1
                          ? "mañana"
                          : `en ${upcoming.daysToDue} días`
                    }`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-foreground">—</p>
                  <p className="text-xs text-muted-foreground">
                    Cargá el vencimiento al registrar una compra a cuenta.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <PlanLockNote plan="esencial">
          Con el Plan Esencial llevás la cuenta corriente con cada proveedor: cuánto les debés, cuándo
          vence cada compra, pagos parciales y el calendario de vencimientos.
        </PlanLockNote>
      )}

      <div className={cn("grid gap-3", accountsEnabled ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
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

        {accountsEnabled && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Calendario</p>
                <Link
                  href="/proveedores/calendario"
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Ver calendario completo
                </Link>
              </div>
              {events.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No hay vencimientos ni entregas en los próximos 7 días. Cargá los días de entrega
                  desde la ficha de cada proveedor.
                </p>
              ) : (
                <div className="mt-2 space-y-0.5">
                  {events.map((e, idx) => {
                    const diff = daysBetween(todayKey, e.day);
                    const label = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : shortDate(e.day);
                    return (
                      <div
                        key={`${e.supplierId}-${e.kind}-${e.day}-${idx}`}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                          diff === 0 && "bg-accent"
                        )}
                      >
                        <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
                          {label}
                        </span>
                        <i
                          className={cn(
                            "inline-block h-2 w-2 shrink-0 rounded-full",
                            e.kind === "entrega"
                              ? "bg-muted-foreground/50"
                              : e.status === "vencida"
                                ? "bg-danger"
                                : e.status === "pronto"
                                  ? "bg-warning"
                                  : "bg-success"
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {e.kind === "entrega"
                            ? `Entrega ${e.supplierName}`
                            : `Vence ${formatCurrency(e.amount ?? 0)} · ${e.supplierName}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <Card>
          <CardContent className="p-0">
            {accountsEnabled && (
              <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2.5">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                      tab === t.key
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t.label}
                    <span className="ml-1.5 font-medium opacity-70">{counts[t.key]}</span>
                  </button>
                ))}
              </div>
            )}
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
                    "hidden gap-3 bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid",
                    gridCols
                  )}
                >
                  <span />
                  <span>Proveedor</span>
                  <span>{accountsEnabled ? "Le debés" : "Última compra"}</span>
                  <span>{accountsEnabled ? "Estado de la deuda" : "Total comprado"}</span>
                  {accountsEnabled && <span>Última compra</span>}
                  <span />
                  <span />
                </div>
                {filtered.map((s) => {
                  const summary = debtSummary(s.items);
                  const owes = s.balance > 0;
                  return (
                    <div
                      key={s.id}
                      className={cn("grid gap-2 px-4 py-2.5 lg:items-center lg:gap-3", gridCols)}
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
                        <p className="truncate text-xs text-muted-foreground">
                          {[s.phone, s.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                        </p>
                      </Link>

                      {accountsEnabled ? (
                        <>
                          <p className="text-sm">
                            {owes ? (
                              <span className="text-base font-bold text-warning">
                                {formatCurrency(s.balance)}
                              </span>
                            ) : (
                              <Badge tone="success">Al día</Badge>
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
                              <span className="text-sm text-muted-foreground">—</span>
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

                      <div className="flex items-center gap-1.5 lg:justify-end">
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

        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-foreground">Últimos movimientos</p>
            {overview.feed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Acá vas a ver las compras a cuenta y los pagos a proveedores.
              </p>
            ) : (
              <div className="mt-1 divide-y divide-border">
                {overview.feed.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-10 shrink-0 text-xs text-muted-foreground">
                      {shortDate(dayKey(f.at))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{f.supplierName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.kind === "pago"
                          ? `Pago${f.detail ? ` · ${(paymentLabels[f.detail] ?? f.detail).toLowerCase()}` : ""}`
                          : `A cuenta${f.detail ? ` · vence ${shortDate(f.detail)}` : ""}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold",
                        f.kind === "pago" ? "text-success" : "text-warning"
                      )}
                    >
                      {`${f.kind === "pago" ? "−" : "+"}${formatCurrency(f.amount)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
        onClose={() => setPaying(null)}
        customPaymentMethods={customPaymentMethods}
      />
    </div>
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
