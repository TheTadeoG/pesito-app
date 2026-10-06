"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import type { SupplierRow } from "@/lib/supplier-overview";
import { addDays, daysBetween, type CalendarEvent } from "@/lib/supplier-debt";
import { SupplierPaymentDialog } from "@/app/(dashboard)/proveedores/supplier-payment-dialog";
import { setPurchaseDueDate } from "@/app/(dashboard)/proveedores/actions";
import { shortDate } from "@/app/(dashboard)/proveedores/debt-format";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface UndatedItem {
  purchaseId: string | null;
  supplierName: string;
  amount: number;
  purchaseDay: string;
}

const STATUS_CHIP: Record<string, string> = {
  vencida: "bg-danger-bg text-danger",
  pronto: "bg-warning-bg text-warning",
  no_vencida: "bg-success-bg text-success",
  sin_fecha: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  vencida: "Vencida",
  pronto: "Vence pronto",
  no_vencida: "No vencida",
};

function longDay(key: string) {
  const text = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function relativeDay(key: string, todayKey: string) {
  const diff = daysBetween(todayKey, key);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return diff > 0 ? `En ${diff} días` : `Hace ${-diff} días`;
}

export function CalendarioClient({
  todayKey,
  monthKey,
  currentMonth,
  prevMonth,
  nextMonth,
  gridStart,
  gridEnd,
  events,
  undated,
  overdueTotal,
  suppliers,
  customPaymentMethods,
}: {
  todayKey: string;
  monthKey: string;
  currentMonth: string;
  prevMonth: string;
  nextMonth: string;
  gridStart: string;
  gridEnd: string;
  events: CalendarEvent[];
  undated: UndatedItem[];
  overdueTotal: number;
  suppliers: SupplierRow[];
  customPaymentMethods: string[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"mes" | "lista">("mes");
  const [selected, setSelected] = useState<string>(
    todayKey.slice(0, 7) === monthKey ? todayKey : `${monthKey}-01`
  );
  const [paying, setPaying] = useState<SupplierRow | null>(null);

  const [yearStr, monthStr] = monthKey.split("-");
  const monthName = MONTHS[Number(monthStr) - 1];

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.day) ?? [];
      list.push(e);
      map.set(e.day, list);
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    const list: string[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) list.push(d);
    return list;
  }, [gridStart, gridEnd]);

  const monthEvents = events.filter((e) => e.day.startsWith(monthKey));
  const dueThisMonth = monthEvents
    .filter((e) => e.kind === "vencimiento" && e.status !== "vencida")
    .reduce((acc, e) => acc + (e.amount ?? 0), 0);
  const selectedEvents = byDay.get(selected) ?? [];

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  return (
    <div className="space-y-3">
      <Link
        href="/proveedores"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver a Proveedores
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/proveedores/calendario?mes=${prevMonth}`} aria-label="Mes anterior">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="min-w-44 text-center text-xl font-bold text-foreground">
            {`${monthName} ${yearStr}`}
          </h2>
          <Link href={`/proveedores/calendario?mes=${nextMonth}`} aria-label="Mes siguiente">
            <Button variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          {monthKey !== currentMonth && (
            <Link href="/proveedores/calendario">
              <Button variant="outline" size="sm">
                Hoy
              </Button>
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-danger-bg ring-1 ring-danger/30" />
              Vencida
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-warning-bg ring-1 ring-warning/30" />
              Vence pronto
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-success-bg ring-1 ring-success/30" />
              No vencida
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50" />
              Entrega
            </span>
          </div>
          <div className="flex rounded-lg bg-muted p-0.5 text-sm font-semibold" role="group" aria-label="Vista">
            {(
              [
                ["mes", "Mes"],
                ["lista", "Lista"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  view === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20.5rem] lg:items-start">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {view === "mes" ? (
              <div className="grid grid-cols-7">
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="border-b border-r border-border bg-muted px-2 py-2 text-xs font-semibold text-muted-foreground"
                  >
                    {w}
                  </div>
                ))}
                {days.map((d) => {
                  const inMonth = d.startsWith(monthKey);
                  const dayEvents = byDay.get(d) ?? [];
                  const venc = dayEvents.filter((e) => e.kind === "vencimiento");
                  const entregas = dayEvents.filter((e) => e.kind === "entrega");
                  const isToday = d === todayKey;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelected(d)}
                      aria-label={longDay(d)}
                      className={cn(
                        "flex min-h-20 flex-col items-stretch gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-muted/60 sm:min-h-24",
                        !inMonth && "bg-muted/40",
                        selected === d && "ring-2 ring-inset ring-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          inMonth ? "text-muted-foreground" : "text-muted-foreground/50"
                        )}
                      >
                        <span
                          className={cn(
                            isToday && "rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground"
                          )}
                        >
                          {Number(d.slice(8))}
                        </span>
                      </span>
                      {venc.slice(0, 2).map((e) => (
                        <span
                          key={`${e.supplierId}-v`}
                          className={cn(
                            "truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                            STATUS_CHIP[e.status ?? "sin_fecha"]
                          )}
                        >
                          {`${e.supplierName} ${formatCurrency(e.amount ?? 0)}`}
                        </span>
                      ))}
                      {venc.length > 2 && (
                        <span className="text-[11px] text-muted-foreground">{`+${venc.length - 2} más`}</span>
                      )}
                      {entregas.slice(0, venc.length > 0 ? 1 : 2).map((e) => (
                        <span
                          key={`${e.supplierId}-e`}
                          className="flex items-center gap-1 truncate text-[11px] text-muted-foreground"
                        >
                          <i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                          <span className="truncate">{`Entrega ${e.supplierName}`}</span>
                        </span>
                      ))}
                      {entregas.length > (venc.length > 0 ? 1 : 2) && (
                        <span className="text-[11px] text-muted-foreground">
                          {`+${entregas.length - (venc.length > 0 ? 1 : 2)} entregas`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {monthEvents.length === 0 ? (
                  <p className="px-5 py-14 text-center text-sm text-muted-foreground">
                    No hay vencimientos ni entregas este mes.
                  </p>
                ) : (
                  monthEvents.map((e, idx) => (
                    <button
                      key={`${e.day}-${e.supplierId}-${e.kind}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelected(e.day);
                        setView("mes");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60"
                    >
                      <span className="w-20 shrink-0 text-sm font-semibold text-foreground">
                        {`${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][(daysBetween("1970-01-05", e.day) % 7 + 7) % 7]} ${Number(e.day.slice(8))}`}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
                          e.kind === "entrega"
                            ? "bg-muted text-muted-foreground"
                            : STATUS_CHIP[e.status ?? "sin_fecha"]
                        )}
                      >
                        {e.kind === "entrega" ? "Entrega" : (STATUS_LABEL[e.status ?? ""] ?? "Vencimiento")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{e.supplierName}</span>
                      {e.kind === "vencimiento" && (
                        <span className="shrink-0 text-sm font-semibold text-foreground">
                          {formatCurrency(e.amount ?? 0)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-sm font-semibold text-foreground">{`${monthName} en números`}</p>
              <div className="mt-2 divide-y divide-border text-sm">
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Vencido, sin pagar</span>
                  <span className={cn("font-semibold", overdueTotal > 0 ? "text-danger" : "text-foreground")}>
                    {formatCurrency(overdueTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Vence este mes</span>
                  <span className="font-semibold text-foreground">{formatCurrency(dueThisMonth)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Sin fecha de vencimiento</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(undated.reduce((acc, u) => acc + u.amount, 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/60">
            <CardContent className="py-4">
              <p className="text-sm font-semibold text-foreground">{longDay(selected)}</p>
              <p className="text-xs text-muted-foreground">{relativeDay(selected, todayKey)}</p>
              {selectedEvents.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No hay vencimientos ni entregas este día.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedEvents.map((e, idx) =>
                    e.kind === "entrega" ? (
                      <p
                        key={`${e.supplierId}-e-${idx}`}
                        className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground"
                      >
                        {`Entrega de ${e.supplierName}`}
                      </p>
                    ) : (
                      <div
                        key={`${e.supplierId}-v-${idx}`}
                        className={cn("rounded-xl px-3 py-2.5", STATUS_CHIP[e.status ?? "sin_fecha"])}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{e.supplierName}</p>
                            <p className="text-xs opacity-80">{STATUS_LABEL[e.status ?? ""] ?? "Vencimiento"}</p>
                          </div>
                          <p className="shrink-0 text-base font-bold">{formatCurrency(e.amount ?? 0)}</p>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setPaying(supplierById.get(e.supplierId) ?? null)}
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Registrar pago
                          </Button>
                          <Link href={`/proveedores/${e.supplierId}`}>
                            <Button size="sm" variant="outline">
                              Ver ficha
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {undated.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <p className="text-sm font-semibold text-foreground">Compras sin fecha de vencimiento</p>
                <p className="text-xs text-muted-foreground">
                  Asignales una fecha para verlas en el calendario.
                </p>
                <div className="mt-2 divide-y divide-border">
                  {undated.slice(0, 6).map((u, idx) => (
                    <UndatedRow
                      key={u.purchaseId ?? `adj-${idx}`}
                      item={u}
                      onSaved={() => router.refresh()}
                    />
                  ))}
                  {undated.length > 6 && (
                    <p className="pt-2 text-xs text-muted-foreground">{`Y ${undated.length - 6} más.`}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <SupplierPaymentDialog
        supplier={paying}
        items={paying?.items}
        onClose={() => setPaying(null)}
        customPaymentMethods={customPaymentMethods}
      />
    </div>
  );
}

function UndatedRow({ item, onSaved }: { item: UndatedItem; onSaved: () => void }) {
  const [date, setDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    onSaved();
  }

  return (
    <div className="space-y-1.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.supplierName}</p>
          <p className="text-xs text-muted-foreground">{`Compra del ${shortDate(item.purchaseDay)}`}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(item.amount)}</p>
      </div>
      {item.purchaseId ? (
        <div className="flex gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label={`Vencimiento de la compra de ${item.supplierName}`}
            className="h-9"
          />
          <Button size="sm" variant="outline" disabled={!date || pending} onClick={save}>
            {pending ? "…" : "Asignar"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Saldo sin compra asociada: no tiene fecha.</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
