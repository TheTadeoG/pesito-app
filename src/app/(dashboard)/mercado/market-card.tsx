"use client";

import { Package } from "lucide-react";
import { positionLabels, storeLabel, type PricePosition } from "@/lib/market-prices";
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

const positionTone: Record<PricePosition, string> = {
  "muy-barato": "bg-accent text-accent-foreground",
  barato: "bg-accent text-accent-foreground",
  "en-rango": "bg-success-bg text-success",
  caro: "bg-warning-bg text-warning",
  "muy-caro": "bg-danger-bg text-danger",
};

/** Tarjeta de un producto: foto, nombre, precio en cada súper (el más barato resaltado) y, si es tuyo, cómo estás. */
export function MarketCard({ data }: { data: MarketCardData }) {
  const { mine } = data;
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      {data.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.imageUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg border border-border bg-white object-contain" />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Package className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{data.name}</p>
            <p className="text-xs text-muted-foreground">{`${data.brand ? `${data.brand} · ` : ""}${data.ean}`}</p>
          </div>
          {mine && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tu precio</p>
              <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(mine.price)}</p>
            </div>
          )}
        </div>

        {data.stores.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.stores.map((s, i) => {
              const chip = (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs tabular-nums",
                    i === 0 ? "border-success/40 bg-success-bg font-semibold text-success" : "border-border text-muted-foreground",
                    !s.available && "line-through opacity-60"
                  )}
                >
                  {`${storeLabel(s.store)} ${formatCurrency(s.price)}`}
                </span>
              );
              return s.url ? (
                <a key={s.store} href={s.url} target="_blank" rel="noopener noreferrer nofollow" title="Ver en la tienda">
                  {chip}
                </a>
              ) : (
                <span key={s.store}>{chip}</span>
              );
            })}
          </div>
        ) : (
          data.emptyNote && <p className="text-xs text-muted-foreground">{data.emptyNote}</p>
        )}

        {mine && mine.position && mine.diff !== null && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", positionTone[mine.position])}>
              {`${positionLabels[mine.position]} (${mine.diff > 0 ? "+" : ""}${mine.diff}%)`}
            </span>
            {mine.suggested !== null && mine.suggested !== mine.price && (
              <span className="text-xs text-muted-foreground" title={mine.reason ?? undefined}>
                {`Sugerido: ${formatCurrency(mine.suggested)}`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
