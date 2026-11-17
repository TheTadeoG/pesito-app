"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { markCatalogDirty } from "@/lib/pos-catalog-store";
import { baseSkuOf } from "@/lib/variants";
import { formatCurrency } from "@/lib/utils";
import { addVariantsToProduct } from "@/app/(dashboard)/productos/actions";
import { EMPTY_VARIANTS, VariantsSection, resolveVariantRows, toVariantInputs, type VariantsState } from "@/app/(dashboard)/productos/variants-section";
import type { Product } from "@/lib/types";

// Suma talles y colores a un producto que ya existe. Si todavía no era una variante, pasa a serlo (se le asigna talle y
// color); si ya lo era, las nuevas se suman a su grupo. Las nuevas copian marca, costo, proveedor, imagen y demás.
export function AddVariantsDialog({
  product,
  products,
  locked,
  sizeSuggestions,
  colorSuggestions,
  onSetGroupPrice,
  onClose,
}: {
  product: Product | null;
  /** Todos los productos, para saber qué variantes tiene ya el grupo. */
  products: Product[];
  locked: boolean;
  sizeSuggestions: string[];
  colorSuggestions: string[];
  /** Mismo precio de venta para todas las variantes del producto; devuelve el error, si hubo. */
  onSetGroupPrice: (price: number) => Promise<string | null>;
  onClose: () => void;
}) {
  const [state, setState] = useState<VariantsState>(EMPTY_VARIANTS);
  const [ownSize, setOwnSize] = useState("");
  const [ownColor, setOwnColor] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isVariant = Boolean(product?.variant_group_id);
  const group = useMemo(
    () => (product?.variant_group_id ? products.filter((p) => p.variant_group_id === product.variant_group_id) : []),
    [products, product]
  );
  const reserved = useMemo(() => {
    const keys = group.map((p) => `${(p.variant_size ?? "").toLowerCase()}|${(p.variant_color ?? "").toLowerCase()}`);
    if (product && !isVariant) keys.push(`${ownSize.trim().toLowerCase()}|${ownColor.trim().toLowerCase()}`);
    return keys;
  }, [group, product, isVariant, ownSize, ownColor]);

  if (!product) return null;
  const baseSku = isVariant ? baseSkuOf(product.sku, product.variant_size ?? "", product.variant_color ?? "") : product.sku;
  const rows = resolveVariantRows(state, baseSku, String(product.price), reserved);

  function close() {
    setState(EMPTY_VARIANTS);
    setOwnSize("");
    setOwnColor("");
    setError(null);
    onClose();
  }

  async function applyBulkPrice() {
    const value = Number(bulkPrice.replace(",", "."));
    if (bulkPrice.trim() === "" || !Number.isFinite(value) || value < 0) {
      setBulkMsg({ ok: false, text: "Poné un precio de cero o más." });
      return;
    }
    setBulkBusy(true);
    const err = await onSetGroupPrice(value);
    setBulkBusy(false);
    if (err) setBulkMsg({ ok: false, text: err });
    else {
      setBulkMsg({ ok: true, text: `Listo: las ${group.length} variantes quedaron a ${formatCurrency(value)}.` });
      setBulkPrice("");
    }
  }

  async function submit() {
    if (!product) return;
    if (!isVariant && !ownSize.trim() && !ownColor.trim()) return setError("Decinos qué talle o color es este producto.");
    if (rows.length === 0) return setError("Elegí al menos un talle o un color nuevo.");
    setPending(true);
    setError(null);
    const res = await addVariantsToProduct(product.id, isVariant ? null : { size: ownSize, color: ownColor }, toVariantInputs(rows));
    markCatalogDirty();
    setPending(false);
    if (res.error && !res.created) return setError(res.error);
    close();
  }

  return (
    <Dialog open onClose={close} size="lg" title={isVariant ? "Talles y colores" : "Agregar talles o colores"} description={product.name}>
      {locked ? (
        <PlanLockNote plan="basico">Los talles y colores están desde el Plan Básico.</PlanLockNote>
      ) : (
        <div className="space-y-4">
          {isVariant ? (
            <div className="rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm">
              <p className="text-muted-foreground">Ya tiene estas variantes:</p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {group.map((p) => (
                  <span key={p.id} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-foreground">
                    {[p.variant_size, p.variant_color].filter(Boolean).join(" · ") || p.name}
                  </span>
                ))}
              </p>
            </div>
          ) : null}
          {isVariant && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3.5">
              <Label htmlFor="av-bulk-price">Precio de venta de todas las variantes</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="av-bulk-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  placeholder="Ej: 4800"
                  className="w-40"
                />
                <Button type="button" variant="outline" disabled={bulkBusy || bulkPrice.trim() === ""} onClick={() => void applyBulkPrice()}>
                  {bulkBusy ? "Guardando…" : `Aplicar a las ${group.length}`}
                </Button>
              </div>
              {bulkMsg && <p className={bulkMsg.ok ? "text-xs font-medium text-success" : "text-xs font-medium text-danger"}>{bulkMsg.text}</p>}
              <p className="text-xs text-muted-foreground">Para ponerle un precio distinto a cada una, tocá su celda en la lista y editala.</p>
            </div>
          )}
          {!isVariant && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3.5">
              <p className="text-sm text-foreground">
                Este producto todavía no tiene variantes: pasa a ser <b>una de ellas</b>. ¿Qué talle y color es?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="av-size">Talle</Label>
                  <Input id="av-size" value={ownSize} onChange={(e) => setOwnSize(e.target.value)} maxLength={40} placeholder="Ej: M" list="av-size-list" />
                  <datalist id="av-size-list">
                    {sizeSuggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="av-color">Color</Label>
                  <Input id="av-color" value={ownColor} onChange={(e) => setOwnColor(e.target.value)} maxLength={40} placeholder="Ej: Azul" list="av-color-list" />
                  <datalist id="av-color-list">
                    {colorSuggestions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{`Su nombre pasa a ser “${[product.name, ownSize.trim(), ownColor.trim()].filter(Boolean).join(" · ")}”. Su SKU, stock y precio no cambian.`}</p>
            </div>
          )}

          <VariantsSection
            embedded
            state={{ ...state, enabled: true }}
            onChange={setState}
            locked={false}
            baseName={product.name}
            baseSku={baseSku}
            basePrice={String(product.price)}
            sizeSuggestions={sizeSuggestions}
            colorSuggestions={colorSuggestions}
            showStock
            reserved={reserved}
          />

          {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={pending || rows.length === 0}>
              {pending ? "Agregando…" : `Agregar ${rows.length} variante${rows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
