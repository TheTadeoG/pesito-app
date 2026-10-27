"use client";

import { useEffect, useState } from "react";
import { getMarketHint, type MarketHint } from "@/app/(dashboard)/mercado/actions";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { diffPct, normalizeEan, pricePosition, positionLabels, storeLabel, suggestPrice } from "@/lib/market-prices";
import { formatCurrency } from "@/lib/utils";

/**
 * Bajo el código de barras del formulario: cuánto cuesta ese producto en los supermercados (Pro) y,
 * con el Plan IA, si el precio cargado está caro o barato y cuál sería el sugerido.
 */
export function MarketHintNote({ barcode, price, cost, onUse }: { barcode: string; price: string; cost: string; onUse: (price: string) => void }) {
  const ean = normalizeEan(barcode);
  const [hint, setHint] = useState<{ ean: string; value: MarketHint } | null>(null);

  useEffect(() => {
    if (!ean) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      getMarketHint(ean)
        .then((value) => {
          if (!cancelled) setHint({ ean, value });
        })
        .catch(() => {});
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [ean]);

  const current = hint && hint.ean === ean ? hint.value : null;
  if (!ean || !current || current.state === "invalid" || current.state === "none") return null;
  if (current.state === "locked") {
    return (
      <PlanLockNote plan={current.plan} className="mt-1" cta="Ver el Plan Pro">
        Mirá cuánto cuesta este producto en los supermercados.
      </PlanLockNote>
    );
  }

  const { stats, stores, insights, insightsPlan } = current;
  const mine = Number(price);
  const costNum = cost.trim() === "" ? null : Number(cost);
  const sug = insights ? suggestPrice(stats, Number.isFinite(costNum) ? costNum : null) : null;
  const position = insights && mine > 0 ? pricePosition(mine, stats) : null;
  const detail = stores.map((s) => `${storeLabel(s.store)} ${formatCurrency(s.price)}`).join(" · ");

  return (
    <div className="mt-1 space-y-1 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <p>
        <span className="font-semibold text-foreground">{`En supermercados: ${formatCurrency(stats.min)}${stats.max !== stats.min ? ` a ${formatCurrency(stats.max)}` : ""}`}</span>
        {` (mediana ${formatCurrency(stats.median)}). ${detail}.`}
      </p>
      {position && position !== "en-rango" && (
        <p className="font-medium text-foreground">{`${positionLabels[position]}: estás ${Math.abs(diffPct(mine, stats))}% ${diffPct(mine, stats) > 0 ? "arriba" : "abajo"} de la mediana.`}</p>
      )}
      {sug && (
        <p>
          {`Precio sugerido: ${formatCurrency(sug.price)}. ${sug.reason} `}
          {String(sug.price) !== price && (
            <button type="button" className="font-semibold text-primary underline" onClick={() => onUse(String(sug.price))}>
              Usar este precio
            </button>
          )}
        </p>
      )}
      {!insights && (
        <PlanLockNote plan={insightsPlan} cta="Ver el Plan IA">
          Con el Plan IA ves si estás caro o barato y el precio sugerido.
        </PlanLockNote>
      )}
    </div>
  );
}
