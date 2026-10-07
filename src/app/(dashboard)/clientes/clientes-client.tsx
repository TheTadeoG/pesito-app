"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  FileSpreadsheet,
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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { featureMinPlan } from "@/lib/plan-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuItem, FilterPanel } from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/utils";
import { chatWhatsappUrl } from "@/lib/whatsapp";
import { dayKey, daysBetween, todayInArgentina } from "@/lib/supplier-debt";
import { agoLabel } from "@/app/(dashboard)/proveedores/debt-format";
import type { Customer } from "@/lib/types";
import { CustomerForm } from "@/app/(dashboard)/clientes/customer-form";
import { PaymentDialog } from "@/app/(dashboard)/clientes/payment-dialog";
import { deleteCustomer } from "@/app/(dashboard)/clientes/actions";
import { CustomerImportDialog } from "@/app/(dashboard)/clientes/customer-import-dialog";
import { downloadCustomersExcel, downloadCustomerTemplate } from "@/app/(dashboard)/clientes/customer-excel";

export interface ClienteRow extends Customer {
  /** Desde cuándo debe (la compra a fiado más vieja que sigue sin pagarse). */
  debtSince: string | null;
  lastPaymentAt: string | null;
  lastSaleAt: string | null;
}

type SortKey = "age" | "name" | "debt" | "payment";
type SortDir = "asc" | "desc";
type AgeKey = "recent" | "month" | "old" | "unknown" | "clear";

const AGE_LABEL: Record<AgeKey, string> = {
  recent: "Hasta 7 días",
  month: "De 8 a 30 días",
  old: "Más de 30 días",
  unknown: "Sin fecha",
  clear: "Al día (sin deuda)",
};
const WITH_DEBT: AgeKey[] = ["recent", "month", "old", "unknown"];

const TABS: { key: string; label: string; ages: AgeKey[] }[] = [
  { key: "debt", label: "Con deuda", ages: WITH_DEBT },
  { key: "all", label: "Todos", ages: [] },
  { key: "clear", label: "Al día", ages: ["clear"] },
];

function sameSet(a: ReadonlySet<AgeKey>, b: readonly AgeKey[]) {
  return a.size === b.length && b.every((k) => a.has(k));
}

function debtDays(row: ClienteRow, todayKey: string): number | null {
  return row.debtSince ? Math.max(0, daysBetween(dayKey(row.debtSince), todayKey)) : null;
}

function ageOf(row: ClienteRow, todayKey: string): AgeKey {
  if (row.balance <= 0) return "clear";
  const days = debtDays(row, todayKey);
  if (days === null) return "unknown";
  if (days > 30) return "old";
  if (days > 7) return "month";
  return "recent";
}

function whatsappMessage(row: ClienteRow) {
  const name = row.name.trim().split(/\s+/)[0];
  return `Hola ${name}, ¿cómo andás? Te escribo para recordarte que tenés ${formatCurrency(row.balance)} pendientes en el negocio. Cuando puedas, avisame. ¡Gracias!`;
}

export function ClientesClient({
  customers,
  customPaymentMethods = [],
  canUseExcel = false,
  importLocked = false,
}: {
  customers: ClienteRow[];
  customPaymentMethods?: string[];
  /** Importar y exportar en masa: sólo quien administra el negocio. */
  canUseExcel?: boolean;
  /** La carga masiva no está en el plan (el ítem abre el aviso del plan). */
  importLocked?: boolean;
}) {
  const router = useRouter();
  const todayKey = todayInArgentina();
  const hasDebtors = customers.some((c) => c.balance > 0);

  const [query, setQuery] = useState("");
  const [ages, setAges] = useState<Set<AgeKey>>(() => new Set(hasDebtors ? WITH_DEBT : []));
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: hasDebtors ? "age" : "name",
    dir: hasDebtors ? "desc" : "asc",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [paying, setPaying] = useState<Customer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLockedOpen, setImportLockedOpen] = useState(false);

  const debtors = useMemo(() => customers.filter((c) => c.balance > 0), [customers]);
  const total = debtors.reduce((acc, c) => acc + c.balance, 0);

  const buckets = useMemo(() => {
    const b = { recent: 0, month: 0, old: 0, unknown: 0 };
    const who = { recent: [] as string[], month: [] as string[], old: [] as string[] };
    for (const c of debtors) {
      const key = ageOf(c, todayKey) as "recent" | "month" | "old" | "unknown";
      b[key] += c.balance;
      if (key !== "unknown") who[key].push(c.name);
    }
    return { amounts: b, who };
  }, [debtors, todayKey]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const tab of TABS) {
      result[tab.key] =
        tab.ages.length === 0
          ? customers.length
          : customers.filter((c) => tab.ages.includes(ageOf(c, todayKey))).length;
    }
    return result;
  }, [customers, todayKey]);

  const activeTab = TABS.find((t) => sameSet(ages, t.ages))?.key ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (ages.size > 0 && !ages.has(ageOf(c, todayKey))) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        Boolean(c.phone?.toLowerCase().includes(q)) ||
        Boolean(c.document?.toLowerCase().includes(q))
      );
    });
    const byName = (a: ClienteRow, b: ClienteRow) => a.name.localeCompare(b.name, "es");
    const compare = (a: ClienteRow, b: ClienteRow) => {
      if (sort.key === "name") return byName(a, b);
      if (sort.key === "debt") return a.balance - b.balance || byName(a, b);
      if (sort.key === "payment") {
        return (a.lastPaymentAt ?? "").localeCompare(b.lastPaymentAt ?? "") || byName(a, b);
      }
      // Antigüedad: el que debe hace más tiempo es "mayor"; sin deuda, al final.
      const da = debtDays(a, todayKey) ?? (a.balance > 0 ? -1 : -2);
      const db = debtDays(b, todayKey) ?? (b.balance > 0 ? -1 : -2);
      return da - db || a.balance - b.balance || byName(a, b);
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => sign * compare(a, b));
  }, [customers, query, ages, sort, todayKey]);

  function sortBy(key: SortKey, firstDir: SortDir) {
    setSort((cur) =>
      cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDir }
    );
  }

  function toggleAge(key: AgeKey) {
    setAges((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`¿Borrar a "${customer.name}"?`)) return;
    setBusyId(customer.id);
    await deleteCustomer(customer.id);
    setBusyId(null);
  }

  const names = (list: string[]) =>
    list.length <= 2 ? list.join(" · ") : `${list.slice(0, 2).join(" · ")} y ${list.length - 2} más`;

  const gridCols =
    "lg:grid-cols-[minmax(0,1.5fr)_7rem_7.5rem_7.5rem_7.5rem_15.5rem_1.75rem]";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono o documento…"
            aria-label="Buscar cliente"
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          {canUseExcel && (
            <DropdownMenu
              trigger={
                <Button variant="outline" className="whitespace-nowrap">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                  <ChevronDown className="h-4 w-4" />
                </Button>
              }
            >
              <DropdownMenuItem onClick={() => (importLocked ? setImportLockedOpen(true) : setImportOpen(true))}>
                <FileSpreadsheet className="h-4 w-4" />
                Cargar desde Excel
                {importLocked && <Badge tone="accent">Esencial</Badge>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void downloadCustomersExcel(customers, todayKey)}>
                <Download className="h-4 w-4" />
                Exportar todos los clientes
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasDebtors}
                onClick={() => void downloadCustomersExcel(customers, todayKey, true)}
              >
                <Download className="h-4 w-4" />
                Exportar solo los que deben
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void downloadCustomerTemplate()}>
                <Download className="h-4 w-4" />
                Descargar planilla modelo
              </DropdownMenuItem>
            </DropdownMenu>
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-foreground/20 bg-card px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Te deben en total</p>
          <p className="text-3xl font-bold leading-tight text-foreground">{formatCurrency(total)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {total > 0
              ? `${debtors.length} de ${customers.length} clientes${
                  buckets.amounts.unknown > 0 ? ` · ${formatCurrency(buckets.amounts.unknown)} sin fecha` : ""
                }`
              : "Nadie te debe nada."}
          </p>
        </div>
        <div
          className={cn(
            "rounded-2xl border px-4 py-3",
            buckets.amounts.old > 0 ? "border-danger/30 bg-danger-bg" : "border-border bg-card"
          )}
        >
          <p className={cn("text-xs font-semibold", buckets.amounts.old > 0 ? "text-danger" : "text-muted-foreground")}>
            Más de 30 días
          </p>
          <p className={cn("text-2xl font-bold", buckets.amounts.old > 0 ? "text-danger" : "text-foreground")}>
            {formatCurrency(buckets.amounts.old)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {buckets.who.old.length > 0 ? names(buckets.who.old) : "Nadie debe hace tanto."}
          </p>
        </div>
        <div
          className={cn(
            "rounded-2xl border px-4 py-3",
            buckets.amounts.month > 0 ? "border-warning/30 bg-warning-bg" : "border-border bg-card"
          )}
        >
          <p className={cn("text-xs font-semibold", buckets.amounts.month > 0 ? "text-warning" : "text-muted-foreground")}>
            De 8 a 30 días
          </p>
          <p className={cn("text-2xl font-bold", buckets.amounts.month > 0 ? "text-warning" : "text-foreground")}>
            {formatCurrency(buckets.amounts.month)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {buckets.who.month.length > 0 ? names(buckets.who.month) : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Hasta 7 días</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(buckets.amounts.recent)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {buckets.who.recent.length > 0 ? names(buckets.who.recent) : "—"}
          </p>
        </div>
      </div>

      <Card>
        <div>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            <div className="flex flex-1 flex-wrap gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={activeTab === t.key}
                  onClick={() => setAges(new Set(t.ages))}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                    activeTab === t.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {`${t.label} ${counts[t.key]}`}
                </button>
              ))}
            </div>
            <FilterPanel
              trigger={
                <span
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-muted",
                    !activeTab && ages.size > 0 ? "bg-accent text-accent-foreground" : "text-foreground"
                  )}
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  Filtrar
                </span>
              }
            >
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Mostrar clientes que deben…</p>
              <div className="space-y-0.5">
                {(Object.keys(AGE_LABEL) as AgeKey[]).map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={ages.has(key)}
                      onChange={() => toggleAge(key)}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <span className="flex-1 font-medium text-foreground">{AGE_LABEL[key]}</span>
                    <span className="text-xs text-muted-foreground">
                      {customers.filter((c) => ageOf(c, todayKey) === key).length}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAges(new Set())}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Limpiar
              </button>
            </FilterPanel>
          </div>

          {!activeTab && ages.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 font-semibold text-accent-foreground">
                {`Deben: ${Array.from(ages).map((a) => AGE_LABEL[a].toLowerCase()).join(", ")}`}
                <button type="button" aria-label="Quitar el filtro" onClick={() => setAges(new Set())}>
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
              aria-label="Ordenar clientes"
            >
              <option value="age:desc">Los que deben hace más, primero</option>
              <option value="debt:desc">Mayor deuda primero</option>
              <option value="name:asc">Ordenar por nombre</option>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {customers.length === 0 ? "Todavía no cargaste clientes." : "No hay clientes con esos filtros."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              <div
                className={cn(
                  "hidden items-center gap-3 bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground lg:grid",
                  gridCols
                )}
              >
                <SortHeader label="Cliente" active={sort.key === "name"} dir={sort.dir} onClick={() => sortBy("name", "asc")} />
                <SortHeader label="Te debe" active={sort.key === "debt"} dir={sort.dir} onClick={() => sortBy("debt", "desc")} />
                <SortHeader label="Debe desde" active={sort.key === "age"} dir={sort.dir} onClick={() => sortBy("age", "desc")} />
                <SortHeader label="Último pago" active={sort.key === "payment"} dir={sort.dir} onClick={() => sortBy("payment", "desc")} />
                <span>Última compra</span>
                <span />
                <span />
              </div>
              {filtered.map((c) => {
                const owes = c.balance > 0;
                const days = debtDays(c, todayKey);
                const whatsapp = owes ? chatWhatsappUrl(c.phone, whatsappMessage(c)) : null;
                return (
                  <div
                    key={c.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, button, input, [role=menuitem], [role=button]")) return;
                      router.push(`/clientes/${c.id}`);
                    }}
                    className={cn(
                      "group grid cursor-pointer gap-1.5 px-4 py-2.5 hover:bg-muted/30 lg:items-center lg:gap-3",
                      gridCols
                    )}
                  >
                    <Link
                      href={`/clientes/${c.id}`}
                      prefetch={false}
                      title="Ver ficha del cliente"
                      className="-mx-2 min-w-0 rounded-lg px-2 py-0.5 transition-colors hover:bg-muted"
                    >
                      <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                      </p>
                    </Link>

                    <p className="text-sm">
                      {owes ? (
                        <span className="text-base font-bold text-foreground">{formatCurrency(c.balance)}</span>
                      ) : c.balance < -0.004 ? (
                        <span className="font-semibold text-success">{`A favor ${formatCurrency(-c.balance)}`}</span>
                      ) : (
                        <span className="text-muted-foreground">Al día</span>
                      )}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        !owes
                          ? "text-muted-foreground"
                          : days === null
                            ? "text-muted-foreground"
                            : days > 30
                              ? "text-danger"
                              : days > 7
                                ? "text-warning"
                                : "text-muted-foreground"
                      )}
                    >
                      <span className="font-normal text-muted-foreground lg:hidden">Debe desde: </span>
                      {owes ? (days === null ? "Sin fecha" : days === 0 ? "hoy" : `hace ${days} ${days === 1 ? "día" : "días"}`) : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="lg:hidden">Último pago: </span>
                      {agoLabel(c.lastPaymentAt, todayKey)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="lg:hidden">Última compra: </span>
                      {agoLabel(c.lastSaleAt, todayKey)}
                    </p>

                    <div className="flex items-center gap-1.5 lg:justify-end">
                      {whatsapp && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Recordarle la deuda a ${c.name} por WhatsApp`}
                          title="Recordarle la deuda por WhatsApp"
                        >
                          <Button size="sm" variant="outline" tabIndex={-1}>
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            Cobrar
                          </Button>
                        </a>
                      )}
                      {owes && (
                        <Button size="sm" className="whitespace-nowrap" onClick={() => setPaying(c)}>
                          <Wallet className="h-3.5 w-3.5" />
                          Registrar pago
                        </Button>
                      )}
                    </div>

                    <div className="flex justify-end lg:justify-center">
                      <DropdownMenu
                        trigger={
                          <button
                            type="button"
                            aria-label={`Más opciones de ${c.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      >
                        <DropdownMenuItem onClick={() => router.push(`/clientes/${c.id}`)}>
                          Ver ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Editar datos
                        </DropdownMenuItem>
                        <DropdownMenuItem danger disabled={busyId === c.id} onClick={() => handleDelete(c)}>
                          <Trash2 className="h-4 w-4" />
                          Borrar cliente
                        </DropdownMenuItem>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <CustomerForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editing}
      />
      <CustomerImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existing={customers.map((c) => ({
          id: c.id,
          name: c.name,
          document: c.document,
          email: c.email,
          phone: c.phone,
        }))}
      />
      <Dialog open={importLockedOpen} onClose={() => setImportLockedOpen(false)} title="Carga masiva con Excel">
        <ProLockedCard
          title="Carga masiva de clientes con Excel"
          plan={featureMinPlan.customerImport}
          description="Subí una planilla con tus clientes y cargalos todos juntos, en vez de uno por uno. Exportar tu lista a Excel está en todos los planes."
        />
      </Dialog>
      <PaymentDialog
        customer={paying}
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
