"use client";

import { ChevronDown, ImageIcon } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { sortSizes } from "@/lib/variants";

/** Talle y color de cada producto que es una variante (los demás no están). */
export type VariantInfo = Record<string, { g: string; s: string | null; c: string | null }>;

interface PosProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  min_stock: number;
  unit: string;
  image_url: string | null;
}

export type ResultItem<P extends PosProduct> =
  | { kind: "product"; product: P }
  | { kind: "group"; id: string; members: P[] };

/** Junta las variantes de un mismo producto en un solo resultado (en el lugar de la primera). */
export function groupResults<P extends PosProduct>(results: P[], info: VariantInfo | undefined): ResultItem<P>[] {
  if (!info) return results.map((product) => ({ kind: "product" as const, product }));
  const byGroup = new Map<string, P[]>();
  for (const p of results) {
    const g = info[p.id]?.g;
    if (g) byGroup.set(g, [...(byGroup.get(g) ?? []), p]);
  }
  const out: ResultItem<P>[] = [];
  const seen = new Set<string>();
  for (const p of results) {
    const g = info[p.id]?.g;
    if (!g) out.push({ kind: "product", product: p });
    else if (!seen.has(g)) {
      seen.add(g);
      out.push({ kind: "group", id: g, members: byGroup.get(g)! });
    }
  }
  return out;
}

function unique(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

function baseName(p: PosProduct, i: VariantInfo[string] | undefined): string {
  const parts = [i?.s, i?.c].filter(Boolean) as string[];
  const suffix = parts.length ? ` · ${parts.join(" · ")}` : "";
  return suffix && p.name.endsWith(suffix) ? p.name.slice(0, -suffix.length) : p.name;
}

export function PosVariantGroup<P extends PosProduct>({
  members,
  info,
  open,
  highlighted,
  onToggle,
  onHover,
  onAdd,
  qtyInCart,
}: {
  members: P[];
  info: VariantInfo;
  open: boolean;
  highlighted: boolean;
  onToggle: () => void;
  onHover: () => void;
  onAdd: (p: P) => void;
  qtyInCart: (id: string) => number;
}) {
  const first = members[0];
  const total = members.reduce((sum, m) => sum + m.stock, 0);
  const minPrice = Math.min(...members.map((m) => m.price));
  const maxPrice = Math.max(...members.map((m) => m.price));
  const sizes = sortSizes(unique(members.map((m) => info[m.id]?.s)));
  const colors = unique(members.map((m) => info[m.id]?.c));
  const what = sizes.length && colors.length ? "talles y colores" : colors.length ? "colores" : "talles";
  const rowKeys: (string | null)[] = sizes.length ? sizes : [null];
  const colKeys: (string | null)[] = colors.length ? colors : [null];
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  const find = (s: string | null, c: string | null) =>
    members.find((m) => norm(info[m.id]?.s) === norm(s) && norm(info[m.id]?.c) === norm(c));
  const image = members.find((m) => m.image_url)?.image_url ?? null;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onHover}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm",
          highlighted || open ? "bg-accent" : "hover:bg-muted"
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-muted-foreground">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate font-medium text-foreground">{baseName(first, info[first.id])}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-white px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              {`Tiene ${what} · ${members.length}`}
              <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {open
              ? "Tocá el talle y color que vendés"
              : `${minPrice === maxPrice ? formatCurrency(minPrice) : `Desde ${formatCurrency(minPrice)}`} · Stock total ${total}${first.unit}`}
          </span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto bg-success-bg/40 px-3.5 pb-3 pt-2 sm:pl-16">
          <table className="border-separate border-spacing-1.5 text-sm">
            <thead>
              <tr>
                <th />
                {colKeys.map((c) => (
                  <th key={c ?? "-"} className="px-1 text-center text-xs font-semibold text-foreground">
                    {c ?? ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((s) => (
                <tr key={s ?? "-"}>
                  <td className="pr-1 text-right text-xs font-bold text-foreground">{s ?? ""}</td>
                  {colKeys.map((c) => {
                    const v = find(s, c);
                    if (!v) return <td key={c ?? "-"} />;
                    const inCart = qtyInCart(v.id);
                    const out = v.stock <= 0;
                    const low = !out && v.stock <= v.min_stock;
                    return (
                      <td key={c ?? "-"}>
                        <button
                          type="button"
                          disabled={out}
                          onClick={() => onAdd(v)}
                          className={cn(
                            "min-w-[78px] rounded-lg border px-2 py-1.5 text-center",
                            out && "cursor-not-allowed border-border bg-muted text-muted-foreground line-through",
                            !out && inCart > 0 && "border-primary bg-primary text-primary-foreground",
                            !out && inCart === 0 && low && "border-warning/40 bg-warning-bg",
                            !out && inCart === 0 && !low && "border-border bg-card hover:bg-muted"
                          )}
                        >
                          <span className="block text-sm font-bold">{`${v.stock}${v.unit}`}</span>
                          <span className="block text-[10.5px] leading-tight opacity-80">
                            {out ? "sin stock" : inCart > 0 ? `${inCart} en el carrito` : formatCurrency(v.price)}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
