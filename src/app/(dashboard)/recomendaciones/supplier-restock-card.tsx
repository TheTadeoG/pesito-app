"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Mail, MessageCircle, PackageCheck, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { createRestockOrder } from "@/app/(dashboard)/recomendaciones/actions";
import { CoverageBar } from "@/app/(dashboard)/recomendaciones/restock-visuals";
import { cn, formatCurrency } from "@/lib/utils";

export interface RestockRowView {
  id: string;
  name: string;
  brand: string | null;
  stockLabel: string;
  daysLeft: number | null;
  urgency: "sin-stock" | "urgente" | "pronto";
  late: boolean;
  lowHistory: boolean;
  /** "12 u" si ya hay un pedido sin recibir de este producto. */
  onOrderLabel: string | null;
  /** Ritmo de venta: "1,5 u por día" (null si no vendió). */
  rateLabel: string | null;
  unit: string;
  /** Stock actual y mínimo del producto (en su unidad). */
  stock: number;
  minStock: number;
  /** Unidades por bulto (null si se compra suelto). */
  packSize: number | null;
  /** Lo sugerido: bultos si viene en bultos, si no unidades. */
  suggestedAmount: number;
  unitCost: number | null;
}

export interface SupplierRestockView {
  key: string;
  supplierId: string | null;
  supplierName: string;
  leadDays: number | null;
  minOrder: number | null;
  phone: string | null;
  email: string | null;
  rows: RestockRowView[];
}

const urgencyStyle = {
  "sin-stock": { label: "Sin stock", className: "bg-danger-bg text-danger" },
  urgente: { label: "Urgente", className: "bg-amber-500/15 text-amber-600" },
  pronto: { label: "Pronto", className: "bg-muted text-muted-foreground" },
} as const;

const MAX_ROWS = 60;
// En la vista reducida se muestran sólo estos productos (los más urgentes).
const REDUCED_ROWS = 5;

const WHOLE_UNITS = new Set(["u", "pack", "caja"]);

function num(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);
}
function withUnit(n: number, unit: string): string {
  return unit === "u" ? num(n) : `${num(n)} ${unit}`;
}

/** Cantidad total en la unidad del producto para lo que se quiere pedir. */
function totalQty(row: RestockRowView, amount: number): number {
  return row.packSize ? amount * row.packSize : amount;
}

/** "2 bultos de 12 (24 u)" o "10 u". */
function qtyLabel(row: RestockRowView, amount: number): string {
  const qty = totalQty(row, amount);
  if (row.packSize) {
    return `${num(amount)} bulto${amount === 1 ? "" : "s"} de ${withUnit(row.packSize, row.unit)} (${withUnit(qty, row.unit)})`;
  }
  return withUnit(qty, row.unit);
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

// Tarjeta de un proveedor en "Qué comprar": se elige qué productos van en el
// pedido y cuánto de cada uno, y de ahí sale el mensaje (copiar, WhatsApp,
// mail) y "Ya lo pedí". Tiene una vista completa y una reducida.
export function SupplierRestockCard({
  group,
  orgName,
  targetDays,
}: {
  group: SupplierRestockView;
  orgName: string;
  targetDays: number;
}) {
  const { showSuccess, showWarning } = useToast();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(group.rows.map((r) => r.id)));
  // Cantidad elegida a mano por producto (bultos o unidades); sin entrada, la sugerida.
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [reduced, setReduced] = useState(group.rows.length > REDUCED_ROWS);
  const [showAll, setShowAll] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [pending, startTransition] = useTransition();

  const amountOf = (r: RestockRowView) => amounts[r.id] ?? r.suggestedAmount;

  const cappedRows = group.rows.slice(0, MAX_ROWS);
  const shownRows = reduced && !showAll ? cappedRows.slice(0, REDUCED_ROWS) : cappedRows;
  const chosen = useMemo(
    () => group.rows.filter((r) => selected.has(r.id) && (amounts[r.id] ?? r.suggestedAmount) > 0),
    [group.rows, selected, amounts]
  );
  const cost = chosen.reduce(
    (n, r) => n + (r.unitCost !== null ? totalQty(r, amounts[r.id] ?? r.suggestedAmount) * r.unitCost : 0),
    0
  );
  const allSelected = selected.size === group.rows.length;
  const edited = Object.keys(amounts).length > 0;

  const message = useMemo(
    () =>
      chosen.length === 0
        ? ""
        : `Hola! Te paso el pedido de ${orgName}:\n${chosen
            .map((r) => `- ${qtyLabel(r, amounts[r.id] ?? r.suggestedAmount)} ${r.name}`)
            .join("\n")}\nGracias!`,
    [chosen, amounts, orgName]
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAmount(row: RestockRowView, raw: string) {
    const parsed = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0) return;
    const value = row.packSize || WHOLE_UNITS.has(row.unit) ? Math.round(parsed) : Math.round(parsed * 10) / 10;
    setAmounts((current) => ({ ...current, [row.id]: value }));
    if (value > 0) setSelected((current) => new Set(current).add(row.id));
  }

  async function copy() {
    if (!message) return;
    if (await copyText(message)) showSuccess("Pedido copiado", "Ya lo podés pegar donde quieras.");
    else showWarning("No pudimos copiar. Seleccioná el mensaje y copialo a mano.");
  }

  function placeOrder() {
    if (!group.supplierId || chosen.length === 0) return;
    if (
      !confirm(
        `¿Ya hiciste este pedido (${chosen.length} producto${chosen.length === 1 ? "" : "s"})? Lo vamos a marcar en camino y no te lo vamos a volver a sugerir hasta que llegue.`
      )
    )
      return;
    const supplierId = group.supplierId;
    startTransition(async () => {
      const result = await createRestockOrder({
        supplierId,
        items: chosen.map((r) => ({
          productId: r.id,
          name: r.name,
          quantity: totalQty(r, amounts[r.id] ?? r.suggestedAmount),
        })),
      });
      if (result.error) {
        showWarning(result.error);
        return;
      }
      showSuccess("Pedido en camino", "Se cierra solo cuando cargues la compra de este proveedor.");
    });
  }

  const belowMin = group.minOrder !== null && cost > 0 && cost < group.minOrder;
  const mailto = group.email
    ? `mailto:${group.email}?subject=${encodeURIComponent(`Pedido de ${orgName}`)}&body=${encodeURIComponent(message)}`
    : null;
  const linkClass =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted";

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{group.supplierName}</p>
            <p className="text-xs text-muted-foreground">
              {`${chosen.length} de ${group.rows.length} producto${group.rows.length === 1 ? "" : "s"}`}
              {cost > 0 && ` · pedido estimado ${formatCurrency(cost)}`}
              {group.leadDays !== null &&
                ` · entrega en ${group.leadDays} día${group.leadDays === 1 ? "" : "s"}`}
            </p>
            {group.minOrder !== null && (
              <p className={cn("text-xs", belowMin ? "font-medium text-warning" : "text-muted-foreground")}>
                {belowMin
                  ? `Pedido mínimo ${formatCurrency(group.minOrder)}: te faltan ${formatCurrency(group.minOrder - cost)} para llegar.`
                  : `Pedido mínimo del proveedor: ${formatCurrency(group.minOrder)}.`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void copy()} disabled={chosen.length === 0}>
              <Copy className="h-4 w-4" />
              Copiar pedido
            </Button>
            <a
              href={chosen.length === 0 ? undefined : whatsappUrl(group.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={chosen.length === 0}
              className={cn(linkClass, chosen.length === 0 && "pointer-events-none opacity-50")}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
            {mailto && (
              <a
                href={chosen.length === 0 ? undefined : mailto}
                aria-disabled={chosen.length === 0}
                className={cn(linkClass, chosen.length === 0 && "pointer-events-none opacity-50")}
              >
                <Mail className="h-4 w-4" />
                Mail
              </a>
            )}
            {group.supplierId && (
              <Button size="sm" onClick={placeOrder} disabled={pending || chosen.length === 0}>
                <PackageCheck className="h-4 w-4" />
                {pending ? "Guardando…" : "Ya lo pedí"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  setSelected(allSelected ? new Set() : new Set(group.rows.map((r) => r.id)))
                }
                className="h-3.5 w-3.5 accent-primary"
              />
              {allSelected ? "Quitar todos" : "Elegir todos"}
            </label>
            {edited && (
              <button
                type="button"
                onClick={() => setAmounts({})}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Volver a lo sugerido
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Vista">
              {[
                { value: false, label: "Completa" },
                { value: true, label: "Reducida" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setReduced(option.value)}
                  aria-pressed={reduced === option.value}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    reduced === option.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowMessage((v) => !v)}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              aria-expanded={showMessage}
            >
              {showMessage ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showMessage ? "Ocultar mensaje" : "Ver mensaje"}
            </button>
          </div>
        </div>

        {showMessage && (
          <pre className="whitespace-pre-wrap rounded-xl bg-muted/60 px-3.5 py-3 font-sans text-sm text-foreground">
            {message || "Elegí al menos un producto para armar el mensaje."}
          </pre>
        )}

        <div className="divide-y divide-border">
          {shownRows.map((r) => {
            const on = selected.has(r.id);
            const amount = amountOf(r);
            return (
              <div
                key={r.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-1",
                  reduced ? "py-2" : "py-2.5",
                  !on && "opacity-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(r.id)}
                  aria-label={`Incluir ${r.name} en el pedido`}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.name}
                    {!reduced && r.brand && (
                      <span className="font-normal text-muted-foreground">{` · ${r.brand}`}</span>
                    )}
                  </p>
                  {reduced ? (
                    <p className="text-xs text-muted-foreground">
                      {`Stock ${r.stockLabel}`}
                      {r.daysLeft !== null && ` · alcanza ${Math.floor(r.daysLeft)} días`}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {`Stock ${r.stockLabel}`}
                        {r.daysLeft !== null
                          ? ` · alcanza ${Math.floor(r.daysLeft)} días`
                          : " · sin ventas en el período"}
                        {r.rateLabel && ` · vendés ${r.rateLabel}`}
                      </p>
                      {r.daysLeft !== null ? (
                        <CoverageBar
                          share={r.daysLeft / Math.max(1, targetDays)}
                          urgency={r.urgency}
                          caption={`Alcanza ${Math.floor(r.daysLeft)} de ${targetDays} días`}
                        />
                      ) : r.minStock > 0 ? (
                        <CoverageBar
                          share={r.stock / r.minStock}
                          urgency={r.urgency}
                          caption={`Stock ${withUnit(Math.max(0, r.stock), r.unit)} de ${withUnit(r.minStock, r.unit)} del mínimo`}
                        />
                      ) : null}
                      {r.onOrderLabel && (
                        <p className="text-xs font-medium text-primary">
                          {`Ya pedido: ${r.onOrderLabel} en camino. Esto es lo que falta además.`}
                        </p>
                      )}
                      {r.late && (
                        <p className="text-xs font-medium text-danger">
                          Se acaba antes de que llegue un pedido: pedilo hoy.
                        </p>
                      )}
                      {r.lowHistory && (
                        <p className="text-xs text-muted-foreground">
                          Pocos datos de venta: el ritmo puede no ser exacto.
                        </p>
                      )}
                    </>
                  )}
                </div>
                <span
                  className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", urgencyStyle[r.urgency].className)}
                >
                  {urgencyStyle[r.urgency].label}
                </span>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={r.packSize || WHOLE_UNITS.has(r.unit) ? 1 : 0.1}
                      value={amount}
                      onChange={(e) => setAmount(r, e.target.value)}
                      aria-label={`Cuánto pedir de ${r.name}${r.packSize ? " (en bultos)" : ""}`}
                      className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-right text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="w-32 text-left text-xs text-muted-foreground">
                    <p className="text-foreground">
                      {r.packSize
                        ? `bulto${amount === 1 ? "" : "s"} de ${withUnit(r.packSize, r.unit)}`
                        : r.unit === "u"
                          ? "unidades"
                          : r.unit}
                    </p>
                    {r.packSize ? <p>{`= ${withUnit(totalQty(r, amount), r.unit)}`}</p> : null}
                    {r.unitCost !== null && amount > 0 && (
                      <p>{formatCurrency(totalQty(r, amount) * r.unitCost)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {reduced && cappedRows.length > REDUCED_ROWS && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showAll
              ? `Mostrar sólo los ${REDUCED_ROWS} más urgentes`
              : `Ver los ${cappedRows.length - REDUCED_ROWS} restantes`}
          </button>
        )}
        {group.rows.length > MAX_ROWS && (
          <p className="text-xs text-muted-foreground">
            {`Mostramos los ${MAX_ROWS} más urgentes; el resto no entra en el pedido.`}
          </p>
        )}
        {chosen.length > 0 && chosen.length < group.rows.length && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            {`El mensaje y el pedido llevan sólo los ${chosen.length} que elegiste.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
