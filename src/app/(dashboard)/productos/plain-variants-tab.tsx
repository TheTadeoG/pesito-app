"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { VariantsSection, type VariantsState } from "@/app/(dashboard)/productos/variants-section";

/** Solapa "Variantes" de un producto que todavía no tiene talles ni colores: pasa a ser una de ellas y se le suman las nuevas. */
export function PlainVariantsTab({
  name,
  sku,
  price,
  ownSize,
  ownColor,
  onOwnChange,
  state,
  onChange,
  locked,
  sizeSuggestions,
  colorSuggestions,
}: {
  name: string;
  sku: string;
  price: string;
  ownSize: string;
  ownColor: string;
  onOwnChange: (size: string, color: string) => void;
  state: VariantsState;
  onChange: (next: VariantsState) => void;
  locked: boolean;
  sizeSuggestions: string[];
  colorSuggestions: string[];
}) {
  if (locked) {
    return <PlanLockNote plan="basico">Los talles y colores están desde el Plan Básico.</PlanLockNote>;
  }
  const own = `${ownSize.trim().toLowerCase()}|${ownColor.trim().toLowerCase()}`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Si este producto viene en varios talles o colores, sumalos acá: cada uno queda con su propio SKU, stock y precio. Si no, dejá esta solapa como está.
      </p>
      <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3.5">
        <p className="text-sm text-foreground">
          Este producto pasa a ser <b>una de las variantes</b>. ¿Qué talle y color es?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pv-size">Talle</Label>
            <Input id="pv-size" value={ownSize} onChange={(e) => onOwnChange(e.target.value, ownColor)} maxLength={40} placeholder="Ej: M" list="pv-size-list" />
            <datalist id="pv-size-list">
              {sizeSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="pv-color">Color</Label>
            <Input id="pv-color" value={ownColor} onChange={(e) => onOwnChange(ownSize, e.target.value)} maxLength={40} placeholder="Ej: Azul" list="pv-color-list" />
            <datalist id="pv-color-list">
              {colorSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{`Su nombre pasa a ser “${[name, ownSize.trim(), ownColor.trim()].filter(Boolean).join(" · ")}”. Su SKU, stock y precio no cambian. Se aplica al guardar.`}</p>
      </div>
      <VariantsSection
        embedded
        state={{ ...state, enabled: true }}
        onChange={onChange}
        locked={false}
        baseName={name}
        baseSku={sku}
        basePrice={price}
        sizeSuggestions={sizeSuggestions}
        colorSuggestions={colorSuggestions}
        showStock
        reserved={[own]}
      />
    </div>
  );
}
