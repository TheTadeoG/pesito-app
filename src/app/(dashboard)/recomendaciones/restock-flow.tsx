"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Copy, Mail, MessageCircle, Minus, Plus, Search, Settings, SkipForward, Truck, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/toast/toast-provider";
import { createRestockOrder } from "@/app/(dashboard)/recomendaciones/actions";
import { cn, formatCurrency } from "@/lib/utils";
import type { FlowGroup, FlowRow, SupplierOption } from "@/lib/restock-view";

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

/** Lo que entra en el pedido por defecto: lo de hoy (o todo, si el proveedor no tiene nada urgente). */
function todayRows(group: FlowGroup): FlowRow[] {
  const urgent = group.rows.filter(isToday);
  return urgent.length > 0 ? urgent : group.rows;
}

function SupplierCard({
  group,
  matches,
  skipped,
  onOpen,
}: {
  group: FlowGroup;
  /** Con una búsqueda activa: los productos que coinciden, para mostrar esos. */
  matches?: FlowRow[];
  /** Se salteó en esta vuelta de "Empezar a pedir". */
  skipped?: boolean;
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
    <Card className={cn("p-4", hasUrgent ? "border-danger/30" : "border-amber-500/30")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{group.supplierName}</p>
          <p className="text-xs text-muted-foreground">
            {group.leadDays !== null
              ? `Entregan en ${group.leadDays} ${plural(group.leadDays, "día", "días")}`
              : "Sin plazo de entrega cargado"}
            {group.minOrder !== null && ` · pedido mínimo ${formatCurrency(group.minOrder)}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-bold",
              hasUrgent ? "bg-danger-bg text-danger" : "bg-amber-500/15 text-amber-600"
            )}
          >
            {hasUrgent ? "Pedilo hoy" : "Pedilo esta semana"}
          </span>
          {skipped && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              Salteado
            </span>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {shown.map((row) => (
          <li key={row.id} className="flex gap-2">
            <span className={cn("shrink-0", stateChip[row.urgency].dot)} aria-hidden>
              ●
            </span>
            <span className="min-w-0 truncate text-foreground">
              {row.name} <span className="text-muted-foreground">— {shortState(row)}</span>
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {`y ${rest} ${plural(rest, "producto más", "productos más")}${hasUrgent && !matches ? " que pueden esperar" : ""}`}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-foreground">{cost > 0 ? formatCurrency(cost) : "—"}</p>
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
        <Button variant={hasUrgent ? "primary" : "outline"} onClick={onOpen}>
          Revisar y pedir
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
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
  suppliers,
  orgName,
  targetDays,
  onBack,
  onDone,
  onSkip,
  progress,
}: {
  group: FlowGroup;
  /** Para elegir a quién se le pide cuando los productos no tienen proveedor habitual. */
  suppliers: SupplierOption[];
  orgName: string;
  targetDays: number;
  onBack: () => void;
  /** Se dejó el pedido en camino: sigue con el próximo proveedor o vuelve al inicio. */
  onDone: () => void;
  /** Pasar al próximo proveedor sin pedirle nada a éste (sólo cuando se recorre de a uno). */
  onSkip: (() => void) | null;
  /** "Pedido 1 de 2" cuando se viene de "Empezar a pedir". */
  progress: { index: number; total: number } | null;
}) {
  const { showSuccess, showWarning } = useToast();
  // Sin proveedor habitual: se puede elegir a quién se le pide.
  const [pickedId, setPickedId] = useState("");
  const picked = group.supplierId ? undefined : suppliers.find((sup) => sup.id === pickedId);
  const supplierId = group.supplierId ?? picked?.id ?? null;
  const supplierName = group.supplierId ? group.supplierName : (picked?.name ?? null);
  const phone = group.supplierId ? group.phone : (picked?.phone ?? null);
  const email = group.supplierId ? group.email : (picked?.email ?? null);
  const leadDaysValue = group.supplierId ? group.leadDays : (picked?.leadDays ?? null);
  const arrival = group.supplierId ? group.arrivalLabel : (picked?.arrivalLabel ?? null);
  const leadDays = leadDaysValue ?? 0;
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
      : `${supplierName ? `Hola! Te paso el pedido de ${orgName}:` : `Lista de compras de ${orgName}:`}\n${chosen.map((r) => `- ${qtyLabel(r, amountOf(r))} ${r.name}`).join("\n")}${supplierName ? "\nGracias!" : ""}`;
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Pedido de ${orgName}`)}&body=${encodeURIComponent(message)}`
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
    if (!supplierId || chosen.length === 0) return;
    const orderSupplierId = supplierId;
    startTransition(async () => {
      const result = await createRestockOrder({
        supplierId: orderSupplierId,
        items: chosen.map((r) => ({ productId: r.id, name: r.name, quantity: totalQty(r, amountOf(r))})),
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
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la lista
      </button>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              {progress && (
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  {`Pedido ${progress.index} de ${progress.total}`}
                </p>
              )}
              <h2 className="text-lg font-bold text-foreground">
                {supplierName ? `Pedido a ${supplierName}` : "Productos sin proveedor habitual"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {!supplierName
                  ? "Elegí a quién se lo vas a pedir, o copiá la lista y mandala vos."
                  : arrival
                    ? `Llegaría el ${arrival} · entregan en ${leadDaysValue} ${plural(leadDaysValue ?? 0, "día", "días")}`
                    : "Cargale el plazo de entrega al proveedor para saber cuándo llega."}
              </p>
              {!group.supplierId && (
                <div className="mt-3 max-w-xs">
                  <label htmlFor="pick-supplier" className="mb-1 block text-xs font-semibold text-muted-foreground">
                    ¿A quién se lo pedís?
                  </label>
                  <Select id="pick-supplier" value={pickedId} onChange={(e) => setPickedId(e.target.value)}>
                    <option value="">Elegí un proveedor</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            {onSkip && (
              <div className="shrink-0 text-right">
                <Button variant="outline" size="sm" onClick={onSkip}>
                  Saltear y seguir con el próximo
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">No pedirle nada ahora</p>
              </div>
            )}
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
            href={disabled ? undefined : whatsappUrl(phone, message)}
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

          {supplierId ? (
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
              Elegí un proveedor arriba para poder dejar el pedido en camino. Si querés que la próxima vez
              salga solo, asignáselo a los productos en Productos.
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
// Todo junto: pantalla de inicio + pedido
// ---------------------------------------------------------------------------

export function RestockFlow({
  groups,
  suppliers,
  orgName,
  targetDays,
  pendingBlock,
  pricesBlock,
  settingsBlock,
}: {
  groups: FlowGroup[];
  suppliers: SupplierOption[];
  orgName: string;
  targetDays: number;
  /** Pedidos en camino, ya armados por el servidor. */
  pendingBlock: ReactNode;
  /** Precios para revisar. */
  pricesBlock: ReactNode;
  /** Ajustes de cálculo (se abren con el engranaje). */
  settingsBlock: ReactNode;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // "Empezar a pedir" recorre a los proveedores de a uno.
  const [queue, setQueue] = useState<string[]>([]);
  // Proveedores salteados en esta vuelta, y el aviso al terminar.
  const [skipped, setSkipped] = useState<string[]>([]);
  const [skipNotice, setSkipNotice] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const active = groups.find((g) => g.key === activeKey) ?? null;

  const urgentGroups = groups.filter((g) => g.rows.some(isToday));
  const weekGroups = groups.filter((g) => !g.rows.some(isToday));
  const urgentProducts = urgentGroups.reduce((n, g) => n + g.rows.filter(isToday).length, 0);
  const urgentCost = urgentGroups.reduce((n, g) => n + groupCost(todayRows(g)), 0);
  const weekProducts = weekGroups.reduce((n, g) => n + g.rows.length, 0);
  const weekCost = weekGroups.reduce((n, g) => n + groupCost(g.rows), 0);

  const query = normalize(search.trim());
  const visible = groups
    .map((g) => {
      const supplierMatch = query !== "" && normalize(g.supplierName).includes(query);
      const matches =
        query === "" || supplierMatch
          ? g.rows
          : g.rows.filter((r) => normalize(`${r.name} ${r.brand ?? ""}`).includes(query));
      return { group: g, matches, focus: query !== "" && !supplierMatch };
    })
    .filter((v) => v.matches.length > 0);
  const visibleUrgent = visible.filter((v) => v.group.rows.some(isToday));
  const visibleWeek = visible.filter((v) => !v.group.rows.some(isToday));

  function start(keys: string[]) {
    setQueue(keys);
    setSkipped([]);
    setSkipNotice(null);
    setActiveKey(keys[0] ?? null);
  }

  function openGroup(key: string) {
    setQueue([]);
    setSkipped([]);
    setActiveKey(key);
  }

  function back() {
    setActiveKey(null);
    setQueue([]);
    setSkipped([]);
  }

  /** Sigue con el próximo proveedor de la vuelta; si no hay, vuelve al inicio y avisa lo salteado. */
  function advance(skippedNow: string[]) {
    const index = activeKey ? queue.indexOf(activeKey) : -1;
    const next = index >= 0 ? queue.slice(index + 1).find((k) => groups.some((g) => g.key === k)) : undefined;
    if (next) {
      setSkipped(skippedNow);
      setActiveKey(next);
      return;
    }
    const names = skippedNow
      .map((k) => groups.find((g) => g.key === k)?.supplierName)
      .filter((n): n is string => Boolean(n));
    setActiveKey(null);
    setQueue([]);
    setSkipped([]);
    setSkipNotice(names.length > 0 ? names : null);
  }

  const done = () => advance(skipped);
  const skip = () => advance(activeKey ? [...skipped, activeKey] : skipped);

  if (active) {
    const index = queue.indexOf(active.key);
    return (
      <OrderSheet
        key={active.key}
        group={active}
        suppliers={suppliers}
        orgName={orgName}
        targetDays={targetDays}
        onBack={back}
        onDone={done}
        onSkip={queue.length > 1 ? skip : null}
        progress={index >= 0 && queue.length > 1 ? { index: index + 1, total: queue.length } : null}
      />
    );
  }

  const renderGrid = (list: typeof visible) => (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((v) => (
        <SupplierCard
          key={v.group.key}
          group={v.group}
          matches={v.focus ? v.matches : undefined}
          skipped={skipNotice?.includes(v.group.supplierName)}
          onOpen={() => openGroup(v.group.key)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {skipNotice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="text-foreground">
            {`Te ${skipNotice.length === 1 ? "quedó" : "quedaron"} ${skipNotice.length} ${plural(skipNotice.length, "proveedor", "proveedores")} sin pedir: `}
            <span className="font-semibold">{skipNotice.join(", ")}</span>
            {". Siguen en la lista para cuando quieras."}
          </p>
          <button
            type="button"
            onClick={() => setSkipNotice(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <Card className="p-6">
          <p className="text-lg font-bold text-foreground">No hace falta pedir nada por ahora</p>
          <p className="mt-1 text-sm text-muted-foreground">
            El stock alcanza para lo que venís vendiendo. Cuando haga falta, te lo avisamos acá.
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Hoy */}
              <div
                className={cn(
                  "rounded-2xl border p-5",
                  urgentGroups.length > 0 ? "border-danger/25 bg-danger-bg/40" : "border-border bg-muted/30"
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "text-5xl font-extrabold leading-none",
                      urgentGroups.length > 0 ? "text-danger" : "text-muted-foreground"
                    )}
                  >
                    {urgentGroups.length}
                  </span>
                  <div>
                    <p className="text-lg font-extrabold leading-snug text-foreground">
                      {urgentGroups.length > 0
                        ? `Hoy tenés que pedirle a ${urgentGroups.length} ${plural(urgentGroups.length, "proveedor", "proveedores")}`
                        : "Hoy no tenés que pedir nada"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {urgentGroups.length > 0
                        ? `${urgentProducts} ${plural(urgentProducts, "producto", "productos")}${urgentCost > 0 ? ` · ${formatCurrency(urgentCost)}` : ""}`
                        : "Nada se acaba antes de que llegue un pedido"}
                    </p>
                  </div>
                </div>
                {urgentGroups.length > 0 && (
                  <Button
                    size="lg"
                    className="mt-4 w-full"
                    onClick={() => start(urgentGroups.map((g) => g.key))}
                  >
                    {urgentGroups.length > 1 ? `Empezar a pedir · 1 de ${urgentGroups.length}` : "Empezar a pedir"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Esta semana */}
              <div
                className={cn(
                  "rounded-2xl border p-5",
                  weekGroups.length > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-muted/30"
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "text-5xl font-extrabold leading-none",
                      weekGroups.length > 0 ? "text-amber-600" : "text-muted-foreground"
                    )}
                  >
                    {weekGroups.length}
                  </span>
                  <div>
                    <p className="text-lg font-extrabold leading-snug text-foreground">
                      {weekGroups.length > 0
                        ? `Esta semana tenés que pedirle a ${weekGroups.length} ${plural(weekGroups.length, "proveedor", "proveedores")}`
                        : "Esta semana no hace falta pedir más"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {weekGroups.length > 0
                        ? `${weekProducts} ${plural(weekProducts, "producto", "productos")}${weekCost > 0 ? ` · ${formatCurrency(weekCost)}` : ""}`
                        : "Todo lo demás todavía te alcanza"}
                    </p>
                  </div>
                </div>
                {weekGroups.length > 0 && (
                  <button
                    type="button"
                    className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/60 bg-card px-6 text-base font-semibold text-amber-600 transition-colors hover:bg-amber-500/10"
                    onClick={() => start(weekGroups.map((g) => g.key))}
                  >
                    {weekGroups.length > 1 ? `Ver y pedir · 1 de ${weekGroups.length}` : "Ver y pedir"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5">
              <SpendChart groups={groups} />
            </div>

            <div className="mt-5 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto o proveedor…"
                  aria-label="Buscar producto o proveedor"
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettings((v) => !v)}
                aria-label="Cómo se calcula"
                title="Cómo se calcula"
                aria-expanded={showSettings}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          {showSettings && settingsBlock}

          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay nada que coincida con esa búsqueda.
            </p>
          ) : (
            <>
              {visibleUrgent.length > 0 && (
                <section className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-danger">
                    <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                    {`Para pedir hoy · ${visibleUrgent.length} ${plural(visibleUrgent.length, "proveedor", "proveedores")}`}
                  </p>
                  {renderGrid(visibleUrgent)}
                </section>
              )}
              {visibleWeek.length > 0 && (
                <section className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-amber-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    {`Para pedir esta semana · ${visibleWeek.length} ${plural(visibleWeek.length, "proveedor", "proveedores")}`}
                  </p>
                  {renderGrid(visibleWeek)}
                </section>
              )}
            </>
          )}
        </>
      )}

      {groups.some((g) => !g.supplierId) && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Truck className="h-3.5 w-3.5" />
          Asignale un proveedor habitual a tus productos (en Productos) para armar el pedido de cada uno.
        </p>
      )}

      {pendingBlock}
      {pricesBlock}
    </div>
  );
}
