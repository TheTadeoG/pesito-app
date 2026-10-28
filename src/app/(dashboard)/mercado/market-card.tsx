"use client";

import { PlanPill } from "@/components/dashboard/pro-locked-card";
import { MARKET_STORES, type PricePosition } from "@/lib/market-prices";
import { cn, formatCurrency } from "@/lib/utils";

export interface MarketCardData {
  key: string;
  name: string;
  brand: string | null;
  ean: string;
  imageUrl: string | null;
  stores: { store: string; price: number; url: string | null; available: boolean }[];
  /** El precio del negocio para este producto (si lo tiene cargado). */
  mine: { price: number; position: PricePosition | null; diff: number | null; suggested: number | null; reason: string | null } | null;
  /** Texto cuando todavía no hay precios de súper. */
  emptyNote?: string;
}

const diffTone: Record<PricePosition, string> = {
  "muy-barato": "text-sky-700 dark:text-sky-400",
  barato: "text-sky-700 dark:text-sky-400",
  "en-rango": "text-success",
  caro: "text-warning",
  "muy-caro": "text-danger",
};

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;

/**
 * Tabla de productos: una fila por producto, una columna por súper (el mejor precio en verde) y,
 * para quien tiene el Plan IA, cuánto se aparta tu precio de la mediana de los súper.
 */
export function MarketTable({ rows, showMine, insights }: { rows: MarketCardData[]; showMine: boolean; insights: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 text-left">Producto</th>
            {showMine && <th className="px-3 py-2.5 text-right">Tu precio</th>}
            {MARKET_STORES.map((s) => (
              <th key={s.id} className="px-3 py-2.5 text-right">{s.label}</th>
            ))}
            {showMine && (
              <th className="px-3 py-2.5 text-right">{insights ? "Vs. súper" : <PlanPill plan="ia" />}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const prices = new Map(r.stores.map((s) => [s.store, s]));
            const best = r.stores.length > 0 ? Math.min(...r.stores.map((s) => s.price)) : null;
            const m = r.mine;
            return (
              <tr key={r.key} className="border-b border-border last:border-0">
                <td className="px-3 py-3">
                  <div className="font-semibold text-foreground">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{`${r.brand ? `${r.brand} · ` : ""}${r.ean}`}</div>
                </td>
                {showMine && (
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-foreground">{m ? formatCurrency(m.price) : "—"}</td>
                )}
                {MARKET_STORES.map((s) => {
                  const p = prices.get(s.id);
                  if (!p) return <td key={s.id} className="px-3 py-3 text-right text-muted-foreground/50">—</td>;
                  const cell = (
                    <span
                      className={cn(
                        "tabular-nums",
                        p.price === best ? "font-bold text-success" : "text-muted-foreground",
                        !p.available && "line-through opacity-60"
                      )}
                    >
                      {formatCurrency(p.price)}
                    </span>
                  );
                  return (
                    <td key={s.id} className="px-3 py-3 text-right">
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" title="Ver en la tienda" className="hover:underline">
                          {cell}
                        </a>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
                {showMine && (
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.stores.length === 0 ? (
                      <span className="text-xs text-muted-foreground">sin datos</span>
                    ) : insights && m?.position && m.diff !== null ? (
                      <div>
                        <span className={cn("font-semibold", diffTone[m.position])}>{signed(m.diff)}</span>
                        {m.suggested !== null && m.suggested !== m.price && (
                          <div className="text-xs text-muted-foreground" title={m.reason ?? undefined}>
                            {`Sugerido ${formatCurrency(m.suggested)}`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
