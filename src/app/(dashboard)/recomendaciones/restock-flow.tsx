"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Copy, Mail, MessageCircle, Minus, Plus, Search, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/toast/toast-provider";
import { createRestockOrder } from "@/app/(dashboard)/recomendaciones/actions";
import { cn, formatCurrency } from "@/lib/utils";
import type { FlowGroup, FlowRow } from "@/lib/restock-view";

const WHOLE_UNITS = new Set(["u", "pack", "caja"]);
const TICK = 0.6; // dónde cae la marca "llega el pedido" en la barra

function num(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);
}
function withUnit(n: number, unit: string): string {
  return unit === "u" ? `${num(n)} u` : `${num(n)} ${unit}`;
}
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

const isWhole = (row: FlowRow) => Boolean(row.packSize) || WHOLE_UNITS.has(row.unit);
const totalQty = (row: FlowRow, amount: number) => (row.packSize ? amount * row.packSize : amount);
const subtotal = (row: FlowRow, amount: number) =>
  row.unitCost !== null ? totalQty(row, amount) * row.unitCost : null;

/** "2 bultos de 6 u (12 u)" o "7 u". */
function qtyLabel(row: FlowRow, amount: number): string {
  if (row.packSize) {
    return `${num(amount)} ${plural(amount, "bulto", "bultos")} de ${withUnit(row.packSize, row.unit)} (${withUnit(totalQty(row, amount), row.unit)})`;
  }
  return withUnit(amount, row.unit);
}

/** Cómo lo llamamos: en palabras de negocio, no "Sin stock / Urgente / Pronto". */
const stateChip = {
  "sin-stock": { label: "Ya se acabó", className: "bg-danger-bg text-danger", dot: "text-danger" },
  urgente: { label: "Se acaba pronto", className: "bg-amber-500/15 text-amber-600", dot: "text-amber-500" },
  pronto: { label: "Queda poco", className: "bg-muted text-muted-foreground", dot: "text-muted-foreground" },
} as const;

function shortState(row: FlowRow): string {
  if (row.urgency === "sin-stock") return "ya se acabó";
  if (row.urgency === "urgente" && row.daysLeft !== null) {
    return `te alcanza ${Math.floor(row.daysLeft)} ${plural(Math.floor(row.daysLeft), "día", "días")}`;
  }
  return "queda poco";
}

/** Sólo con código de país (54…) sirve para abrir el chat directo de WhatsApp. */
function whatsappUrl(phone: string | null, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const target = digits.startsWith("54") && digits.length >= 11 ? digits : "";
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Los que se acaban antes de que llegue un pedido nuevo (o ya se acabaron). */
const isToday = (row: FlowRow) => row.urgency !== "pronto";

// ---------------------------------------------------------------------------
// Barra con la marca de cuándo llega el pedido
// ---------------------------------------------------------------------------

function Timeline({
  row,
  leadDays,
  targetDays,
  wide,
}: {
  row: FlowRow;
  leadDays: number;
  targetDays: number;
  wide?: boolean;
}) {
  const fill =
    row.urgency === "pronto" ? "bg-primary" : row.urgency === "urgente" ? "bg-amber-500" : "bg-danger";
  let share = 0;
  let tick = false;
  let caption: ReactNode = null;

  if (row.daysLeft !== null && leadDays > 0) {
    const scale = leadDays / TICK;
    share = row.daysLeft / scale;
    tick = true;
    const left = Math.floor(row.daysLeft);
    const short = row.daysLeft < leadDays;
    caption = (
      <>
        {`Te alcanza ${left} ${plural(left, "día", "días")} · el pedido llega en ${leadDays}`}
        {short && (
          <span className={row.urgency === "sin-stock" ? "text-danger" : "text-amber-600"}>
            {row.urgency === "sin-stock"
              ? " · te quedás sin nada"
              : ` · te ${plural(Math.ceil(leadDays - row.daysLeft), "falta", "faltan")} ${Math.ceil(leadDays - row.daysLeft)} ${plural(Math.ceil(leadDays - row.daysLeft), "día", "días")}`}
          </span>
        )}
      </>
    );
  } else if (row.daysLeft !== null) {
    share = row.daysLeft / Math.max(1, targetDays);
    const left = Math.floor(row.daysLeft);
    caption = `Te alcanza ${left} ${plural(left, "día", "días")} de ${targetDays} que querés cubrir`;
  } else if (row.minStock > 0) {
    share = row.stock / row.minStock;
    caption = `Tenés ${withUnit(Math.max(0, row.stock), row.unit)} de ${withUnit(row.minStock, row.unit)} del mínimo`;
  } else {
    return null;
  }

  const clamped = Math.max(0, Math.min(1, share));
  return (
    <div className="mt-1.5">
      <div className={cn("relative h-2 rounded-full bg-muted", wide ? "w-full" : "w-48 max-w-full")}>
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", fill)}
          style={{ width: `${Math.max(clamped * 100, row.urgency === "sin-stock" ? 0 : 3)}%` }}
        />
        {tick && (
          <span
            className="absolute -inset-y-1 w-0.5 rounded bg-foreground"
            style={{ left: `${TICK * 100}%` }}
            title="Acá llega el pedido"
          />
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla 1: qué pedir hoy
// ---------------------------------------------------------------------------

function todayRows(group: FlowGroup): FlowRow[] {
  const urgent = group.rows.filter(isToday);
  return urgent.length > 0 ? urgent : group.rows;
}

function SupplierRow({
  group,
  matches,
  onOpen,
}: {
  group: FlowGroup;
  /** Con una búsqueda activa: los productos que coinciden, para mostrar esos. */
  matches?: FlowRow[];
  onOpen: () => void;
}) {
  const urgent = group.rows.filter(isToday);
  const hasUrgent = urgent.length > 0;
  const main = todayRows(group);
  const listed = matches && matches.length > 0 ? matches : main;
  const shown = listed.slice(0, 2);
  const rest = (matches && matches.length > 0 ? matches.length : group.rows.length) - shown.length;
  const cost = main.reduce((n, r) => n + (subtotal(r, r.suggestedAmount) ?? 0), 0);
  const belowMin = group.minOrder !== null && cost > 0 && cost < group.minOrder;

  return (
    <div className="flex flex-col gap-3 border-t border-border py-4 md:flex-row md:items-center md:gap-5">
      <div className={cn("hidden w-1.5 shrink-0 self-stretch rounded-full md:block", hasUrgent ? "bg-danger" : "bg-muted-foreground/30")} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <p className="text-base font-semibold text-foreground">{group.supplierName}</p>
          <p className="text-xs text-muted-foreground">
            {group.leadDays !== null
              ? `entregan en ${group.leadDays} ${plural(group.leadDays, "día", "días")}`
              : "sin plazo de entrega cargado"}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {shown.map((row) => (
            <span
              key={row.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-sm"
            >
              <span className={cn("shrink-0 text-xs", stateChip[row.urgency].dot)} aria-hidden>
                ●
              </span>
              <span className="truncate font-medium text-foreground">{row.name}</span>
              <span className="shrink-0 text-muted-foreground">{shortState(row)}</span>
            </span>
          ))}
          {rest > 0 && (
            <span className="inline-flex items-center rounded-full bg-muted/70 px-3 py-1 text-sm text-muted-foreground">
              {`+ ${rest} ${hasUrgent ? plural(rest, "que puede esperar", "que pueden esperar") : plural(rest, "más", "más")}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-5 md:justify-end">
        <div className="md:text-right">
          <p className="text-lg font-extrabold text-foreground">{cost > 0 ? formatCurrency(cost) : "—"}</p>
          {belowMin && group.minOrder !== null ? (
            <p className="text-xs font-medium text-warning">
              {`Te faltan ${formatCurrency(group.minOrder - cost)} para el mínimo`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {`${main.length} ${plural(main.length, "producto", "productos")}${hasUrgent ? " urgentes" : ""}`}
            </p>
          )}
        </div>
        <Button variant={hasUrgent ? "primary" : "outline"} onClick={onOpen} className="shrink-0">
          {hasUrgent ? "Revisar y pedir" : "Revisar"}
          {hasUrgent && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla 2: armar el pedido a un proveedor
// ---------------------------------------------------------------------------

function OrderRow({
  row,
  amount,
  leadDays,
  targetDays,
  onAmount,
  onRemove,
}: {
  row: FlowRow;
  amount: number;
  leadDays: number;
  targetDays: number;
  onAmount: (value: number) => void;
  onRemove: () => void;
}) {
  const [why, setWhy] = useState(false);
  const step = isWhole(row) ? 1 : 0.5;
  const sub = subtotal(row, amount);
  const set = (value: number) => onAmount(Math.max(0, isWhole(row) ? Math.round(value) : Math.round(value * 10) / 10));

  return (
    <div className="border-t border-border py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-semibold text-foreground">
            {row.name}
            {row.brand && <span className="font-normal text-muted-foreground">{` · ${row.brand}`}</span>}
          </p>
          <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", stateChip[row.urgency].className)}>
            {stateChip[row.urgency].label}
          </span>
          <Timeline row={row} leadDays={leadDays} targetDays={targetDays} />
          {row.onOrderLabel && (
            <p className="mt-1 text-xs font-medium text-primary">
              {`Ya pediste ${row.onOrderLabel} y todavía no llegó: esto es lo que falta además.`}
            </p>
          )}
          {row.lowHistory && (
            <p className="mt-1 text-xs text-muted-foreground">
              Vendés hace poco: la cantidad puede no ser exacta.
            </p>
          )}
          <div className="mt-1.5 flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setWhy((v) => !v)}
              aria-expanded={why}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {why ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              ¿Por qué esta cantidad?
            </button>
            <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground hover:underline">
              Sacar del pedido
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => set(amount - step)}
                aria-label="Pedir menos"
                className="flex h-9 w-9 items-center justify-center bg-muted/60 hover:bg-muted"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={step}
                value={amount}
                onChange={(e) => {
                  const parsed = Number(e.target.value.replace(",", "."));
                  if (e.target.value.trim() !== "" && Number.isFinite(parsed)) set(parsed);
                }}
                aria-label={`Cuánto pedir de ${row.name}`}
                className="h-9 w-14 border-x border-border bg-card text-center text-sm font-bold text-foreground outline-none"
              />
              <button
                type="button"
                onClick={() => set(amount + step)}
                aria-label="Pedir más"
                className="flex h-9 w-9 items-center justify-center bg-muted/60 hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {row.packSize
                ? `${plural(amount, "bulto", "bultos")} de ${withUnit(row.packSize, row.unit)}`
                : row.unit === "u"
                  ? "unidades"
                  : row.unit}
            </p>
          </div>
          <div className="w-24 text-right">
            <p className="text-sm font-bold text-foreground">{sub !== null ? formatCurrency(sub) : "—"}</p>
            <p className="text-xs text-muted-foreground">
              {row.packSize ? `= ${withUnit(totalQty(row, amount), row.unit)}` : ""}
              {row.unitCost !== null ? `${row.packSize ? " · " : ""}${formatCurrency(row.unitCost)} c/u` : ""}
            </p>
          </div>
        </div>
      </div>
      {why && (
        <div className="mt-2.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm text-foreground">{row.why}</div>
      )}
    </div>
  );
}

function OrderSheet({
  group,
  orgName,
  targetDays,
  onBack,
  onDone,
  progress,
}: {
  group: FlowGroup;
  orgName: string;
  targetDays: number;
  onBack: () => void;
  /** Se dejó el pedido en camino: sigue con el próximo proveedor o vuelve al inicio. */
  onDone: () => void;
  /** "Pedido 1 de 2" cuando se viene de "Empezar a pedir". */
  progress: { index: number; total: number } | null;
}) {
  const { showSuccess, showWarning } = useToast();
  const leadDays = group.leadDays ?? 0;
  // Por defecto entra lo que hay que pedir hoy (o todo, si nada es urgente).
  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(todayRows(group).map((r) => r.id))
  );
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [showRest, setShowRest] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const amountOf = (r: FlowRow) => amounts[r.id] ?? r.suggestedAmount;
  const chosen = useMemo(
    () => group.rows.filter((r) => included.has(r.id) && (amounts[r.id] ?? r.suggestedAmount) > 0),
    [group.rows, included, amounts]
  );
  const outside = group.rows.filter((r) => !included.has(r.id));
  const inToday = group.rows.filter((r) => included.has(r.id) && isToday(r));
  const inWeek = group.rows.filter((r) => included.has(r.id) && !isToday(r));

  const cost = chosen.reduce((n, r) => n + (subtotal(r, amountOf(r)) ?? 0), 0);
  const belowMin = group.minOrder !== null && cost > 0 && cost < group.minOrder;
  const message =
    chosen.length === 0
      ? ""
      : `Hola! Te paso el pedido de ${orgName}:\n${chosen.map((r) => `- ${qtyLabel(r, amountOf(r))} ${r.name}`).join("\n")}\nGracias!`;
  const mailto = group.email
    ? `mailto:${group.email}?subject=${encodeURIComponent(`Pedido de ${orgName}`)}&body=${encodeURIComponent(message)}`
    : null;

  const setAmount = (r: FlowRow, value: number) => {
    setAmounts((current) => ({ ...current, [r.id]: value }));
    if (value > 0) setIncluded((current) => new Set(current).add(r.id));
  };
  const remove = (r: FlowRow) =>
    setIncluded((current) => {
      const next = new Set(current);
      next.delete(r.id);
      return next;
    });
  const add = (rows: FlowRow[]) =>
    setIncluded((current) => {
      const next = new Set(current);
      for (const r of rows) next.add(r.id);
      return next;
    });

  async function copy() {
    if (!message) return;
    if (await copyText(message)) {
      showSuccess("Pedido copiado", "Ya lo podés pegar donde quieras.");
      setSent(true);
    } else {
      showWarning("No pudimos copiar. Seleccioná el mensaje y copialo a mano.");
    }
  }

  function markOrdered() {
    if (!group.supplierId || chosen.length === 0) return;
    const supplierId = group.supplierId;
    startTransition(async () => {
      const result = await createRestockOrder({
        supplierId,
        items: chosen.map((r) => ({ productId: r.id, name: r.name, quantity: totalQty(r, amountOf(r)) })),
      });
      if (result.error) {
        showWarning(result.error);
        return;
      }
      showSuccess("Pedido en camino", "Se cierra solo cuando cargues la compra de este proveedor.");
      onDone();
    });
  }

  const disabled = chosen.length === 0;
  const linkClass =
    "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted";

  const renderRows = (rows: FlowRow[]) =>
    rows.map((row) => (
      <OrderRow
        key={row.id}
        row={row}
        amount={amountOf(row)}
        leadDays={leadDays}
        targetDays={targetDays}
        onAmount={(value) => setAmount(row, value)}
        onRemove={() => remove(row)}
      />
    ));

  return (
    <div className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              {progress && (
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  {`Pedido ${progress.index} de ${progress.total}`}
                </p>
              )}
              <h2 className="text-lg font-bold text-foreground">{`Pedido a ${group.supplierName}`}</h2>
              <p className="text-sm text-muted-foreground">
                {group.arrivalLabel
                  ? `Llegaría el ${group.arrivalLabel} · entregan en ${group.leadDays} ${plural(group.leadDays ?? 0, "día", "días")}`
                  : "Cargale el plazo de entrega al proveedor para saber cuándo llega."}
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          </div>

          {inToday.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-bold text-foreground">
                <span className="text-danger">● </span>
                Pedilo hoy <span className="font-normal text-muted-foreground">{`· ${inToday.length} ${plural(inToday.length, "producto", "productos")}`}</span>
              </p>
              {renderRows(inToday)}
            </div>
          )}
          {inWeek.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-bold text-foreground">
                <span className="text-amber-500">● </span>
                Pedilo esta semana <span className="font-normal text-muted-foreground">{`· ${inWeek.length} ${plural(inWeek.length, "producto", "productos")}`}</span>
              </p>
              {renderRows(inWeek)}
            </div>
          )}
          {chosen.length === 0 && (
            <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              El pedido está vacío. Sumá productos de abajo.
            </p>
          )}

          {outside.length > 0 && (
            <div className="mt-5 rounded-xl border border-dashed border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {outside.every((r) => !isToday(r)) ? "Pueden esperar" : "Fuera del pedido"}
                  </span>
                  {` · ${outside.length} ${plural(outside.length, "producto", "productos")}`}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowRest((v) => !v)}>
                    {showRest ? "Ocultar" : "Ver"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => add(outside)}>
                    <Plus className="h-3.5 w-3.5" />
                    Sumar {outside.length === 1 ? "al pedido" : "todos"}
                  </Button>
                </div>
              </div>
              {!showRest && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {outside.map((r) => r.name).join(" · ")}
                </p>
              )}
              {showRest && (
                <ul className="mt-2 divide-y divide-border">
                  {outside.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {`Tenés ${r.stockLabel} · ${shortState(r)}`}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => add([r])}>
                        <Plus className="h-3.5 w-3.5" />
                        Sumar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        <Card className="space-y-3 p-5 lg:sticky lg:top-4">
          <p className="font-bold text-foreground">Tu pedido</p>
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted-foreground">
              {`${chosen.length} ${plural(chosen.length, "producto", "productos")}`}
            </span>
            <span className="text-2xl font-bold text-foreground">{cost > 0 ? formatCurrency(cost) : "—"}</span>
          </div>
          {group.minOrder !== null && (
            <p className={cn("text-xs font-medium", belowMin ? "text-warning" : "text-muted-foreground")}>
              {belowMin
                ? `Pedido mínimo ${formatCurrency(group.minOrder)}: te faltan ${formatCurrency(group.minOrder - cost)}`
                : `Pedido mínimo del proveedor: ${formatCurrency(group.minOrder)}`}
            </p>
          )}
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/60 px-3.5 py-3 font-sans text-xs text-foreground">
            {message || "Elegí al menos un producto para armar el mensaje."}
          </pre>
          <a
            href={disabled ? undefined : whatsappUrl(group.phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setSent(true)}
            aria-disabled={disabled}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Enviar por WhatsApp
          </a>
          <div className="flex gap-2">
            <button type="button" onClick={() => void copy()} disabled={disabled} className={cn(linkClass, "disabled:opacity-50")}>
              <Copy className="h-4 w-4" />
              Copiar
            </button>
            {mailto && (
              <a
                href={disabled ? undefined : mailto}
                onClick={() => setSent(true)}
                aria-disabled={disabled}
                className={cn(linkClass, disabled && "pointer-events-none opacity-50")}
              >
                <Mail className="h-4 w-4" />
                Mail
              </a>
            )}
          </div>

          {group.supplierId ? (
            sent && !disabled ? (
              <div className="rounded-xl bg-accent/50 p-3.5">
                <p className="text-sm font-semibold text-foreground">¿Ya se lo mandaste?</p>
                <p className="mb-2.5 text-xs text-muted-foreground">
                  Lo dejamos en camino y no te lo volvemos a sugerir hasta que llegue.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={markOrdered} disabled={pending}>
                    {pending ? "Guardando…" : "Sí, ya lo pedí"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSent(false)} disabled={pending}>
                    Todavía no
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSent(true)}
                disabled={disabled}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
              >
                Lo pedí por otro medio: marcar como pedido
              </button>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Estos productos no tienen proveedor habitual: asignáselo en Productos para poder dejar el
              pedido en camino.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function rowCost(row: FlowRow): number {
  return subtotal(row, row.suggestedAmount) ?? 0;
}
function groupCost(rows: FlowRow[]): number {
  return rows.reduce((n, r) => n + rowCost(r), 0);
}
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Totales de lo sugerido: cuánta plata y cuántos productos hay en cada urgencia. */
function Totals({ groups, pendingCount }: { groups: FlowGroup[]; pendingCount: number }) {
  const all = groups.flatMap((g) => g.rows);
  const today = all.filter(isToday);
  const week = all.filter((r) => !isToday(r));
  const tiles = [
    { label: "Total sugerido", cost: groupCost(all), count: all.length, tone: "text-foreground", hint: `${groups.length} ${plural(groups.length, "proveedor", "proveedores")}` },
    { label: "Para pedir hoy", cost: groupCost(today), count: today.length, tone: "text-danger", hint: "se acaban antes de que llegue el pedido" },
    { label: "Esta semana", cost: groupCost(week), count: week.length, tone: "text-amber-600", hint: "todavía te alcanzan unos días" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">{t.label}</p>
          <p className={cn("mt-0.5 text-2xl font-extrabold", t.tone)}>{t.cost > 0 ? formatCurrency(t.cost) : "—"}</p>
          <p className="text-xs text-muted-foreground">
            {`${t.count} ${plural(t.count, "producto", "productos")} · ${t.hint}`}
          </p>
        </div>
      ))}
      <div className="rounded-xl border border-border px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground">En camino</p>
        <p className="mt-0.5 text-2xl font-extrabold text-foreground">{pendingCount}</p>
        <p className="text-xs text-muted-foreground">{plural(pendingCount, "pedido sin recibir", "pedidos sin recibir")}</p>
      </div>
    </div>
  );
}

/** Cuánto se pediría a cada proveedor, separando lo de hoy de lo de esta semana. */
function SpendChart({ groups }: { groups: FlowGroup[] }) {
  const rows = groups
    .map((g) => ({
      key: g.key,
      name: g.supplierName,
      today: groupCost(g.rows.filter(isToday)),
      week: groupCost(g.rows.filter((r) => !isToday(r))),
    }))
    .filter((r) => r.today + r.week > 0)
    .sort((a, b) => b.today + b.week - (a.today + a.week))
    .slice(0, 6);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.today + r.week), 1);
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Cuánto pedirías a cada proveedor</p>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          <span><span className="text-danger">●</span> Para hoy</span>
          <span><span className="text-amber-500">●</span> Esta semana</span>
        </p>
      </div>
      <ul className="mt-2.5 space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-foreground">{r.name}</span>
            <span className="flex h-2.5 overflow-hidden rounded-full bg-muted" style={{ width: "100%" }}>
              <span className="h-full bg-danger" style={{ width: `${(r.today / max) * 100}%` }} />
              <span className="h-full bg-amber-500" style={{ width: `${(r.week / max) * 100}%` }} />
            </span>
            <span className="font-semibold text-foreground">{formatCurrency(r.today + r.week)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Todo junto: pestañas + pantalla de inicio + pedido
// ---------------------------------------------------------------------------

type Tab = "pedir" | "camino" | "precios";

export function RestockFlow({
  groups,
  orgName,
  targetDays,
  pendingCount,
  priceCount,
  pendingBlock,
  pricesBlock,
  settingsBlock,
}: {
  groups: FlowGroup[];
  orgName: string;
  targetDays: number;
  pendingCount: number;
  priceCount: number;
  /** Pedidos en camino, ya armados por el servidor. */
  pendingBlock: ReactNode;
  /** Precios para revisar. */
  pricesBlock: ReactNode;
  /** Ajustes de cálculo. */
  settingsBlock: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("pedir");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // "Empezar a pedir" recorre a los proveedores urgentes de a uno.
  const [queue, setQueue] = useState<string[]>([]);
  // Buscador y filtros de la lista de proveedores.
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<"todos" | "hoy" | "semana">("todos");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sort, setSort] = useState<"urgencia" | "monto" | "nombre">("urgencia");
  const active = groups.find((g) => g.key === activeKey) ?? null;

  const urgentGroups = groups.filter((g) => g.rows.some(isToday));
  const urgentProducts = groups.reduce((n, g) => n + g.rows.filter(isToday).length, 0);
  const toOrder = urgentGroups.length > 0 ? urgentGroups.length : groups.length;

  const query = normalize(search.trim());
  const filtersActive = query !== "" || urgencyFilter !== "todos" || supplierFilter !== "";
  const visible = groups
    .filter((g) => !supplierFilter || g.key === supplierFilter)
    .map((g) => {
      const supplierMatch = query !== "" && normalize(g.supplierName).includes(query);
      const bucket =
        urgencyFilter === "hoy"
          ? g.rows.filter(isToday)
          : urgencyFilter === "semana"
            ? g.rows.filter((r) => !isToday(r))
            : g.rows;
      const matches =
        query === "" || supplierMatch
          ? bucket
          : bucket.filter((r) => normalize(`${r.name} ${r.brand ?? ""}`).includes(query));
      return { group: g, matches, focus: query !== "" && !supplierMatch };
    })
    .filter((v) => v.matches.length > 0)
    .sort((a, b) => {
      if (sort === "nombre") return a.group.supplierName.localeCompare(b.group.supplierName, "es");
      if (sort === "monto") return groupCost(b.group.rows) - groupCost(a.group.rows);
      const ua = a.group.rows.some(isToday) ? 0 : 1;
      const ub = b.group.rows.some(isToday) ? 0 : 1;
      return ua - ub;
    });
  const visibleUrgent = visible.filter((v) => v.group.rows.some(isToday));
  const visibleCalm = visible.filter((v) => !v.group.rows.some(isToday));
  const openGroup = (key: string) => {
    setQueue([]);
    setActiveKey(key);
  };

  function start() {
    const keys = (urgentGroups.length > 0 ? urgentGroups : groups).map((g) => g.key);
    setQueue(keys);
    setActiveKey(keys[0] ?? null);
  }

  function back() {
    setActiveKey(null);
    setQueue([]);
  }

  function done() {
    const index = activeKey ? queue.indexOf(activeKey) : -1;
    const next = index >= 0 ? queue.slice(index + 1).find((k) => groups.some((g) => g.key === k)) : undefined;
    if (next) {
      setActiveKey(next);
    } else {
      back();
    }
  }

  if (active) {
    const index = queue.indexOf(active.key);
    return (
      <OrderSheet
        key={active.key}
        group={active}
        orgName={orgName}
        targetDays={targetDays}
        onBack={back}
        onDone={done}
        progress={index >= 0 && queue.length > 1 ? { index: index + 1, total: queue.length } : null}
      />
    );
  }

  const tabs: { id: Tab; label: string; count: number; alert?: boolean }[] = [
    { id: "pedir", label: "Para pedir", count: toOrder, alert: urgentGroups.length > 0 },
    { id: "camino", label: "En camino", count: pendingCount },
    { id: "precios", label: "Precios para revisar", count: priceCount },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-[3px] px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-bold",
                  t.alert && tab !== t.id ? "bg-danger-bg text-danger" : t.alert ? "bg-danger-bg text-danger" : "bg-muted text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "pedir" && (
        <div className="space-y-5">
          {groups.length === 0 ? (
            <Card className="p-6">
              <p className="text-lg font-bold text-foreground">No hace falta pedir nada por ahora</p>
              <p className="mt-1 text-sm text-muted-foreground">
                El stock alcanza para lo que venís vendiendo. Cuando haga falta, te lo avisamos acá.
              </p>
            </Card>
          ) : (
            <Card className="px-5 pb-2 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "text-5xl font-extrabold leading-none",
                      urgentProducts > 0 ? "text-danger" : "text-foreground"
                    )}
                  >
                    {urgentProducts > 0 ? urgentProducts : groups.reduce((n, g) => n + g.rows.length, 0)}
                  </span>
                  <div>
                    <p className="text-xl font-extrabold text-foreground">
                      {urgentProducts > 0
                        ? `${plural(urgentProducts, "producto", "productos")} para pedir hoy`
                        : "productos para ir pidiendo esta semana"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {`a ${toOrder} ${plural(toOrder, "proveedor", "proveedores")}`}
                      {urgentProducts > 0
                        ? " · si no los pedís, se te acaban antes de que llegue el pedido"
                        : " · todavía te alcanzan unos días"}
                    </p>
                  </div>
                </div>
                <Button size="lg" onClick={start}>
                  {toOrder > 1 ? `Empezar a pedir · 1 de ${toOrder}` : "Empezar a pedir"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {["Revisá lo que sugerimos", "Mandalo por WhatsApp", "Cuando llegue, cargá la compra"].map((label, i) => (
                  <li key={label} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white",
                        i === 0 ? "bg-primary" : "bg-muted-foreground/40"
                      )}
                    >
                      {i + 1}
                    </span>
                    {label}
                    {i < 2 && <span aria-hidden className="ml-1 hidden h-px w-6 bg-border sm:block" />}
                  </li>
                ))}
              </ol>

              <div className="mt-5 space-y-3 border-t border-border pt-5">
                <Totals groups={groups} pendingCount={pendingCount} />
                <SpendChart groups={groups} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <div className="relative min-w-[13rem] flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar producto o proveedor…"
                    aria-label="Buscar producto o proveedor"
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-0.5 rounded-xl border border-border bg-muted/40 p-0.5" role="group" aria-label="Urgencia">
                  {(
                    [
                      ["todos", "Todos"],
                      ["hoy", "Para hoy"],
                      ["semana", "Esta semana"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setUrgencyFilter(value)}
                      aria-pressed={urgencyFilter === value}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        urgencyFilter === value
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  aria-label="Filtrar por proveedor"
                  className="sm:w-48"
                >
                  <option value="">Todos los proveedores</option>
                  {groups.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.supplierName}
                    </option>
                  ))}
                </Select>
                <Select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "urgencia" | "monto" | "nombre")}
                  aria-label="Ordenar"
                  className="sm:w-44"
                >
                  <option value="urgencia">Más urgente primero</option>
                  <option value="monto">Mayor monto primero</option>
                  <option value="nombre">Por nombre</option>
                </Select>
                {filtersActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setUrgencyFilter("todos");
                      setSupplierFilter("");
                    }}
                  >
                    Limpiar
                  </Button>
                )}
              </div>

              {visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay nada que coincida con esa búsqueda o esos filtros.
                </p>
              ) : (
                <>
                  {visibleUrgent.length > 0 && (
                    <div className="mt-4">
                      <p className="pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {sort === "urgencia" ? "Ordenados por urgencia" : "Con productos para hoy"}
                      </p>
                      {visibleUrgent.map((v) => (
                        <SupplierRow
                          key={v.group.key}
                          group={v.group}
                          matches={v.focus || urgencyFilter !== "todos" ? v.matches : undefined}
                          onOpen={() => openGroup(v.group.key)}
                        />
                      ))}
                    </div>
                  )}
                  {visibleCalm.length > 0 && (
                    <div className="mt-2">
                      <p className="border-t border-border pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {visibleUrgent.length > 0 ? "Sin apuro · esta semana" : "Esta semana"}
                      </p>
                      {visibleCalm.map((v) => (
                        <SupplierRow
                          key={v.group.key}
                          group={v.group}
                          matches={v.focus || urgencyFilter !== "todos" ? v.matches : undefined}
                          onOpen={() => openGroup(v.group.key)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {groups.some((g) => !g.supplierId) && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Truck className="h-3.5 w-3.5" />
              Asignale un proveedor habitual a tus productos (en Productos) para armar el pedido de cada uno.
            </p>
          )}
          {settingsBlock}
        </div>
      )}

      {tab === "camino" &&
        (pendingBlock ?? (
          <Card className="p-6">
            <p className="font-semibold text-foreground">No tenés pedidos en camino</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando mandes un pedido y lo marques como hecho, lo vas a ver acá hasta que llegue.
            </p>
          </Card>
        ))}

      {tab === "precios" && pricesBlock}
    </div>
  );
}
