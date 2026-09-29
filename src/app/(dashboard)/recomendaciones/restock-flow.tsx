"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Mail,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/toast/toast-provider";
import { closeRestockOrder, createRestockOrder } from "@/app/(dashboard)/recomendaciones/actions";
import { PendingOrderCard, type PendingOrderView } from "@/app/(dashboard)/recomendaciones/restock-orders";
import { cn, formatCurrency } from "@/lib/utils";
import type { FlowGroup, FlowRow, SupplierOption } from "@/lib/restock-view";

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

const WHOLE_UNITS = new Set(["u", "pack", "caja"]);

function num(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);
}
function withUnit(n: number, unit: string): string {
  return unit === "u" ? `${num(n)} u` : `${num(n)} ${unit}`;
}
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const isWhole = (row: FlowRow) => Boolean(row.packSize) || WHOLE_UNITS.has(row.unit);
const totalQty = (row: FlowRow, amount: number) => (row.packSize ? amount * row.packSize : amount);
const subtotal = (row: FlowRow, amount: number) =>
  row.unitCost !== null ? totalQty(row, amount) * row.unitCost : null;
const rowCost = (row: FlowRow) => subtotal(row, row.suggestedAmount) ?? 0;

/** Los que se acaban antes de que llegue un pedido nuevo (o ya se acabaron). */
const isToday = (row: FlowRow) => row.urgency !== "pronto";

/** Lo que entra por defecto en el pedido: lo de hoy (o todo, si el proveedor no tiene nada urgente). */
function todayRows(group: FlowGroup): FlowRow[] {
  const urgent = group.rows.filter(isToday);
  return urgent.length > 0 ? urgent : group.rows;
}

/** "2 bultos de 6 u (12 u)" o "7 u". */
function qtyLabel(row: FlowRow, amount: number): string {
  if (row.packSize) {
    return `${num(amount)} ${plural(amount, "bulto", "bultos")} de ${withUnit(row.packSize, row.unit)} (${withUnit(totalQty(row, amount), row.unit)})`;
  }
  return withUnit(amount, row.unit);
}

/** La etiqueta corta de cada producto, en palabras de negocio. */
function stateChip(row: FlowRow): { label: string; className: string } {
  if (row.urgency === "sin-stock") return { label: "Se acabó", className: "bg-danger-bg text-danger" };
  const days = row.daysLeft !== null ? Math.floor(row.daysLeft) : null;
  if (row.urgency === "urgente") {
    return {
      label: days !== null ? `Queda para ${days} ${plural(days, "día", "días")}` : "Se acaba pronto",
      className: "bg-amber-500/15 text-amber-600",
    };
  }
  return {
    label: days !== null ? `Alcanza ${days} ${plural(days, "día", "días")}` : "Queda poco",
    className: "bg-muted text-muted-foreground",
  };
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

// ---------------------------------------------------------------------------
// Un producto del pedido
// ---------------------------------------------------------------------------

function LineRow({
  row,
  amount,
  onAmount,
  onRemove,
}: {
  row: FlowRow;
  amount: number;
  onAmount: (value: number) => void;
  onRemove: () => void;
}) {
  const [why, setWhy] = useState(false);
  const step = isWhole(row) ? 1 : 0.5;
  const sub = subtotal(row, amount);
  const chip = stateChip(row);
  const set = (value: number) =>
    onAmount(Math.max(0, isWhole(row) ? Math.round(value) : Math.round(value * 10) / 10));

  return (
    <div className="border-t border-border px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Sacar ${row.name} del pedido`}
          title="Sacar del pedido"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        <div className="min-w-0 flex-1 basis-52">
          <p className="text-sm font-semibold text-foreground">
            {row.name}
            <span
              className={cn("ml-2 inline-block rounded-full px-2.5 py-0.5 align-middle text-xs font-bold", chip.className)}
            >
              {chip.label}
            </span>
          </p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
            <button
              type="button"
              onClick={() => setWhy((v) => !v)}
              aria-expanded={why}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              {why ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              ¿Por qué esta cantidad?
            </button>
            {row.onOrderLabel && (
              <span className="font-medium text-primary">{`Ya pediste ${row.onOrderLabel} y no llegó`}</span>
            )}
            {row.lowHistory && (
              <span className="text-muted-foreground">Vendés hace poco: puede no ser exacto</span>
            )}
          </div>
        </div>

        <div className="text-center">
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
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.packSize
              ? `${plural(amount, "bulto", "bultos")} de ${withUnit(row.packSize, row.unit)} = ${withUnit(totalQty(row, amount), row.unit)}`
              : row.unit === "u"
                ? "unidades"
                : row.unit}
          </p>
        </div>

        <p className="w-24 text-right text-sm font-bold text-foreground">{sub !== null ? formatCurrency(sub) : "—"}</p>
      </div>
      {why && <div className="mt-2.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm text-foreground">{row.why}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Un proveedor: fila que se abre en el mismo lugar
// ---------------------------------------------------------------------------

function SupplierPanel({
  group,
  suppliers,
  orgName,
  open,
  onToggle,
  progress,
  onOrdered,
}: {
  group: FlowGroup;
  suppliers: SupplierOption[];
  orgName: string;
  open: boolean;
  onToggle: () => void;
  /** "Pedido 1 de 2" cuando se viene de "Revisar y mandar". */
  progress: { index: number; total: number } | null;
  onOrdered: (info: { orderId: string; name: string }) => void;
}) {
  const { showSuccess, showWarning } = useToast();
  const [included, setIncluded] = useState<Set<string>>(() => new Set(todayRows(group).map((r) => r.id)));
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [showRest, setShowRest] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [sent, setSent] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [pending, startTransition] = useTransition();

  // Sin proveedor habitual: se puede elegir a quién se le pide.
  const picked = group.supplierId ? undefined : suppliers.find((sup) => sup.id === pickedId);
  const supplierId = group.supplierId ?? picked?.id ?? null;
  const supplierName = group.supplierId ? group.supplierName : (picked?.name ?? null);
  const phone = group.supplierId ? group.phone : (picked?.phone ?? null);
  const email = group.supplierId ? group.email : (picked?.email ?? null);
  const leadDays = group.supplierId ? group.leadDays : (picked?.leadDays ?? null);
  const arrival = group.supplierId ? group.arrivalLabel : (picked?.arrivalLabel ?? null);

  const amountOf = (r: FlowRow) => amounts[r.id] ?? r.suggestedAmount;
  const chosen = useMemo(
    () => group.rows.filter((r) => included.has(r.id) && (amounts[r.id] ?? r.suggestedAmount) > 0),
    [group.rows, included, amounts]
  );
  const inOrder = group.rows.filter((r) => included.has(r.id));
  const outside = group.rows.filter((r) => !included.has(r.id));
  const hasUrgent = group.rows.some(isToday);

  const cost = chosen.reduce((n, r) => n + (subtotal(r, amountOf(r)) ?? 0), 0);
  const suggestedCost = todayRows(group).reduce((n, r) => n + rowCost(r), 0);
  const belowMin = group.minOrder !== null && cost > 0 && cost < group.minOrder;
  const message =
    chosen.length === 0
      ? ""
      : `${supplierName ? `Hola! Te paso el pedido de ${orgName}:` : `Lista de compras de ${orgName}:`}\n${chosen
          .map((r) => `- ${qtyLabel(r, amountOf(r))} ${r.name}`)
          .join("\n")}${supplierName ? "\nGracias!" : ""}`;
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Pedido de ${orgName}`)}&body=${encodeURIComponent(message)}`
    : null;
  const disabled = chosen.length === 0;

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
      showWarning("No pudimos copiar. Abrí «Ver el mensaje» y copialo a mano.");
    }
  }

  function markOrdered() {
    if (!supplierId || chosen.length === 0) return;
    const orderSupplierId = supplierId;
    startTransition(async () => {
      const result = await createRestockOrder({
        supplierId: orderSupplierId,
        items: chosen.map((r) => ({ productId: r.id, name: r.name, quantity: totalQty(r, amountOf(r)) })),
      });
      if (result.error || !result.orderId) {
        showWarning(result.error ?? "No pudimos guardar el pedido.");
        return;
      }
      onOrdered({ orderId: result.orderId, name: supplierName ?? group.supplierName });
    });
  }

  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40",
          open && hasUrgent && "bg-danger-bg/30"
        )}
      >
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", hasUrgent ? "bg-danger" : "bg-muted-foreground/40")} />
        <span className="min-w-0 flex-1">
          {progress && open && (
            <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-primary">
              {`Pedido ${progress.index} de ${progress.total}`}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="truncate text-base font-bold text-foreground">{group.supplierName}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-bold",
                hasUrgent ? "bg-danger-bg text-danger" : "bg-amber-500/15 text-amber-600"
              )}
            >
              {hasUrgent ? "Pedilo hoy" : "Pedilo esta semana"}
            </span>
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {open
              ? group.supplierId
                ? group.leadDays !== null
                  ? `Entregan en ${group.leadDays} ${plural(group.leadDays, "día", "días")}${group.arrivalLabel ? ` · llegaría el ${group.arrivalLabel}` : ""}`
                  : "Sin plazo de entrega cargado"
                : "Estos productos no tienen proveedor habitual"
              : `${todayRows(group)
                  .slice(0, 3)
                  .map((r) => r.name)
                  .join(" · ")}${group.rows.length > 3 ? ` · +${group.rows.length - 3}` : ""}`}
          </span>
          {!open && group.minOrder !== null && suggestedCost > 0 && suggestedCost < group.minOrder && (
            <span className="block text-xs font-medium text-warning">
              {`Te faltan ${formatCurrency(group.minOrder - suggestedCost)} para el pedido mínimo`}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-extrabold text-foreground">
            {(open ? cost : suggestedCost) > 0 ? formatCurrency(open ? cost : suggestedCost) : "—"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {open
              ? `${chosen.length} ${plural(chosen.length, "producto", "productos")}`
              : `${todayRows(group).length} ${plural(todayRows(group).length, "producto", "productos")}`}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div>
          {!group.supplierId && (
            <div className="border-t border-border px-5 py-3">
              <label htmlFor={`pick-${group.key}`} className="mb-1 block text-xs font-semibold text-muted-foreground">
                ¿A quién se lo pedís?
              </label>
              <Select
                id={`pick-${group.key}`}
                value={pickedId}
                onChange={(e) => setPickedId(e.target.value)}
                className="max-w-xs"
              >
                <option value="">Elegí un proveedor (o copiá la lista)</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </Select>
              {picked && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {arrival ? `Llegaría el ${arrival}` : leadDays === null ? "Sin plazo de entrega cargado" : ""}
                </p>
              )}
            </div>
          )}

          {inOrder.map((row) => (
            <LineRow
              key={row.id}
              row={row}
              amount={amountOf(row)}
              onAmount={(value) => setAmount(row, value)}
              onRemove={() => remove(row)}
            />
          ))}
          {inOrder.length === 0 && (
            <p className="border-t border-border px-5 py-6 text-center text-sm text-muted-foreground">
              El pedido está vacío. Sumá productos de abajo.
            </p>
          )}

          {outside.length > 0 && (
            <div className="border-t border-border bg-muted/30 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {`+ ${outside.length} ${plural(outside.length, "producto más puede", "productos más pueden")} esperar`}
                  {!showRest && (
                    <span className="text-foreground">{` · ${outside.slice(0, 2).map((r) => r.name).join(", ")}${outside.length > 2 ? "…" : ""}`}</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowRest((v) => !v)}>
                    {showRest ? "Ocultar" : "Ver"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => add(outside)}>
                    <Plus className="h-3.5 w-3.5" />
                    {outside.length === 1 ? "Sumar" : "Sumar todos"}
                  </Button>
                </div>
              </div>
              {showRest && (
                <ul className="mt-2 divide-y divide-border">
                  {outside.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{`Tenés ${r.stockLabel} · ${stateChip(r).label.toLowerCase()}`}</p>
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

          {showMessage && (
            <pre className="mx-5 mb-3 whitespace-pre-wrap rounded-xl bg-muted/60 px-3.5 py-3 font-sans text-sm text-foreground">
              {message || "Elegí al menos un producto para armar el mensaje."}
            </pre>
          )}

          {sent && supplierId && !disabled && (
            <div className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">¿Ya se lo mandaste?</p>
                <p className="text-xs text-muted-foreground">
                  Lo dejamos en camino y no te lo volvemos a sugerir hasta que llegue.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={markOrdered} disabled={pending}>
                  {pending ? "Guardando…" : "Sí, ya lo pedí"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSent(false)} disabled={pending}>
                  Todavía no
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-accent/30 px-5 py-3.5">
            <div className="text-sm">
              <span className="font-bold text-foreground">{`Total ${cost > 0 ? formatCurrency(cost) : "—"}`}</span>
              {group.minOrder !== null ? (
                <span className={cn("ml-2", belowMin ? "font-medium text-warning" : "text-muted-foreground")}>
                  {belowMin
                    ? `· te faltan ${formatCurrency(group.minOrder - cost)} para el mínimo`
                    : `· pedido mínimo ${formatCurrency(group.minOrder)}`}
                </span>
              ) : (
                <span className="ml-2 text-muted-foreground">· sin pedido mínimo</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {supplierId && !sent && !disabled && (
                <button
                  type="button"
                  onClick={() => setSent(true)}
                  className="hidden text-xs text-muted-foreground hover:text-foreground hover:underline sm:block"
                >
                  Lo pedí por otro medio
                </button>
              )}
              <DropdownMenu
                trigger={
                  <Button variant="outline" aria-label="Más opciones">
                    <MoreHorizontal className="h-4 w-4" />
                    Más
                  </Button>
                }
              >
                <DropdownMenuItem onClick={() => void copy()} disabled={disabled}>
                  <Copy className="h-4 w-4" />
                  Copiar el pedido
                </DropdownMenuItem>
                {mailto && (
                  <DropdownMenuItem
                    onClick={() => {
                      setSent(true);
                      window.location.href = mailto;
                    }}
                    disabled={disabled}
                  >
                    <Mail className="h-4 w-4" />
                    Mandar por mail
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowMessage((v) => !v)}>
                  <MessageCircle className="h-4 w-4" />
                  {showMessage ? "Ocultar el mensaje" : "Ver el mensaje"}
                </DropdownMenuItem>
              </DropdownMenu>
              <a
                href={disabled ? undefined : whatsappUrl(phone, message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSent(true)}
                aria-disabled={disabled}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover",
                  disabled && "pointer-events-none opacity-50"
                )}
              >
                <MessageCircle className="h-4 w-4" />
                Mandar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Todo junto
// ---------------------------------------------------------------------------

export function RestockFlow({
  groups,
  suppliers,
  orgName,
  pending,
  settingsBlock,
  pricesBlock,
}: {
  groups: FlowGroup[];
  suppliers: SupplierOption[];
  orgName: string;
  /** Pedidos ya enviados que todavía no llegaron. */
  pending: PendingOrderView[];
  /** Ajustes de cálculo (se abren con el engranaje). */
  settingsBlock: ReactNode;
  /** Precios para revisar. */
  pricesBlock: ReactNode;
}) {
  const { showSuccess, showWarning } = useToast();
  const [view, setView] = useState<"pedir" | "esperando">("pedir");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  // "Revisar y mandar" recorre a los proveedores de a uno.
  const [queue, setQueue] = useState<string[]>([]);
  const [weekPrompt, setWeekPrompt] = useState<string[] | null>(null);
  const [justSent, setJustSent] = useState<{ orderId: string; name: string } | null>(null);
  const [undoing, startUndo] = useTransition();

  const urgentGroups = groups.filter((g) => g.rows.some(isToday));
  const weekGroups = groups.filter((g) => !g.rows.some(isToday));
  const [openKey, setOpenKey] = useState<string | null>(() => (urgentGroups[0] ?? groups[0])?.key ?? null);

  const urgentRows = urgentGroups.flatMap((g) => g.rows.filter(isToday));
  const soldOut = urgentRows.filter((r) => r.urgency === "sin-stock").length;
  const runningLow = urgentRows.filter((r) => r.urgency === "urgente").length;
  const urgentCost = urgentGroups.reduce((n, g) => n + todayRows(g).reduce((m, r) => m + rowCost(r), 0), 0);
  const weekRows = weekGroups.reduce((n, g) => n + g.rows.length, 0);

  const query = normalize(search.trim());
  const visible = groups.filter(
    (g) =>
      query === "" ||
      normalize(g.supplierName).includes(query) ||
      g.rows.some((r) => normalize(`${r.name} ${r.brand ?? ""}`).includes(query))
  );
  const visibleUrgent = visible.filter((g) => g.rows.some(isToday));
  const visibleWeek = visible.filter((g) => !g.rows.some(isToday));

  // El aviso de "Deshacer" desaparece solo.
  useEffect(() => {
    if (!justSent) return;
    const id = window.setTimeout(() => setJustSent(null), 12000);
    return () => window.clearTimeout(id);
  }, [justSent]);

  function start(keys: string[]) {
    setWeekPrompt(null);
    setQueue(keys);
    setView("pedir");
    setOpenKey(keys[0] ?? null);
  }

  function handleOrdered(key: string, info: { orderId: string; name: string }) {
    setJustSent(info);
    const index = queue.indexOf(key);
    const next = index >= 0 ? queue.slice(index + 1).find((k) => groups.some((g) => g.key === k)) : undefined;
    if (next) {
      setOpenKey(next);
      return;
    }
    setOpenKey(null);
    // Terminó lo de hoy: se ofrece seguir con los proveedores de esta semana.
    const remainingWeek = weekGroups.filter((g) => g.key !== key).map((g) => g.key);
    if (index >= 0 && remainingWeek.length > 0 && urgentGroups.some((g) => queue.includes(g.key))) {
      setWeekPrompt(remainingWeek);
    }
    setQueue([]);
  }

  function undo() {
    if (!justSent) return;
    const { orderId } = justSent;
    startUndo(async () => {
      const result = await closeRestockOrder(orderId, "cancelado");
      if (result.error) {
        showWarning(result.error);
        return;
      }
      setJustSent(null);
      showSuccess("Pedido deshecho", "Los productos vuelven a sugerirse.");
    });
  }

  const guidedKeys = urgentGroups.length > 0 ? urgentGroups.map((g) => g.key) : weekGroups.map((g) => g.key);
  const allClear = groups.length === 0;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <Card className="p-5">
        {allClear ? (
          <div className="py-2 text-center">
            <p className="text-3xl">✅</p>
            <p className="mt-1 text-xl font-extrabold text-foreground">Todo al día</p>
            <p className="text-sm text-muted-foreground">
              No hace falta pedir nada por ahora. Te avisamos cuando haga falta.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-foreground">
                {urgentRows.length > 0
                  ? `Hoy tenés que pedir ${urgentRows.length} ${plural(urgentRows.length, "producto", "productos")}`
                  : "Nada urgente por hoy"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {soldOut > 0 && (
                  <span className="rounded-full bg-danger-bg px-3 py-0.5 text-xs font-bold text-danger">
                    {`${soldOut} sin stock`}
                  </span>
                )}
                {runningLow > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-xs font-bold text-amber-600">
                    {`${runningLow} por acabarse`}
                  </span>
                )}
                {urgentRows.length === 0 && weekRows > 0 && (
                  <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-bold text-muted-foreground">
                    {`${weekRows} para esta semana`}
                  </span>
                )}
                {urgentCost > 0 && (
                  <span className="text-muted-foreground">
                    {`· ${formatCurrency(urgentCost)} en ${urgentGroups.length} ${plural(urgentGroups.length, "proveedor", "proveedores")}`}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <Button size="lg" onClick={() => start(guidedKeys)}>
                {guidedKeys.length > 1 ? `Revisar y mandar · 1 de ${guidedKeys.length}` : "Revisar y mandar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              {guidedKeys.length > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">Te llevo de a un proveedor</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5" role="tablist">
            {(
              [
                ["pedir", "Para pedir", groups.length],
                ["esperando", "Esperando", pending.length],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                  view === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs font-bold",
                      id === "pedir" && urgentGroups.length > 0
                        ? "bg-danger-bg text-danger"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-56 max-w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto o proveedor"
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
        </div>
      </Card>

      {showSettings && settingsBlock}

      {weekPrompt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Listo con lo de hoy.</span>{" "}
            {`Te ${weekPrompt.length === 1 ? "queda" : "quedan"} ${weekPrompt.length} ${plural(weekPrompt.length, "proveedor", "proveedores")} para pedir esta semana.`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => start(weekPrompt)}>
              Seguir con esos
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWeekPrompt(null)}>
              Ahora no
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {view === "pedir" && !allClear && (
        <>
          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay nada que coincida con esa búsqueda.</p>
          ) : (
            <Card className="overflow-hidden">
              {visibleUrgent.length > 0 && (
                <p className="flex items-center gap-2 bg-danger-bg/40 px-5 py-2 text-xs font-bold uppercase tracking-wide text-danger">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  {`Para pedir hoy · ${visibleUrgent.length} ${plural(visibleUrgent.length, "proveedor", "proveedores")}`}
                </p>
              )}
              {visibleUrgent.map((group) => {
                const index = queue.indexOf(group.key);
                return (
                  <SupplierPanel
                    key={group.key}
                    group={group}
                    suppliers={suppliers}
                    orgName={orgName}
                    open={openKey === group.key}
                    onToggle={() => setOpenKey(openKey === group.key ? null : group.key)}
                    progress={index >= 0 && queue.length > 1 ? { index: index + 1, total: queue.length } : null}
                    onOrdered={(info) => handleOrdered(group.key, info)}
                  />
                );
              })}
              {visibleWeek.length > 0 && (
                <p className="flex items-center gap-2 border-t border-border bg-amber-500/10 px-5 py-2 text-xs font-bold uppercase tracking-wide text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {`Para pedir esta semana · ${visibleWeek.length} ${plural(visibleWeek.length, "proveedor", "proveedores")}`}
                </p>
              )}
              {visibleWeek.map((group) => {
                const index = queue.indexOf(group.key);
                return (
                  <SupplierPanel
                    key={group.key}
                    group={group}
                    suppliers={suppliers}
                    orgName={orgName}
                    open={openKey === group.key}
                    onToggle={() => setOpenKey(openKey === group.key ? null : group.key)}
                    progress={index >= 0 && queue.length > 1 ? { index: index + 1, total: queue.length } : null}
                    onOrdered={(info) => handleOrdered(group.key, info)}
                  />
                );
              })}
            </Card>
          )}
        </>
      )}

      {view === "esperando" && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <Card className="p-6">
              <p className="font-semibold text-foreground">No tenés pedidos esperando</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando mandes un pedido y lo marques como hecho, lo vas a ver acá hasta que llegue.
              </p>
            </Card>
          ) : (
            <>
              {pending.map((order) => (
                <PendingOrderCard key={order.id} order={order} />
              ))}
              <p className="text-xs text-muted-foreground">
                Se cierran solos cuando cargás la compra a ese proveedor. Lo que viene en camino no se vuelve a
                sugerir.
              </p>
            </>
          )}
        </div>
      )}

      {view === "pedir" && pricesBlock}

      {justSent && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <div className="inline-flex items-center gap-4 rounded-2xl bg-foreground px-5 py-3 text-sm text-background shadow-lg">
            <span>{`✓ Pedido a ${justSent.name} enviado`}</span>
            <button
              type="button"
              onClick={undo}
              disabled={undoing}
              className="font-bold text-emerald-300 hover:underline disabled:opacity-60"
            >
              {undoing ? "Deshaciendo…" : "Deshacer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
