"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Printer, Search, Wand2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Ean13Svg } from "@/components/dashboard/ean13-svg";
import { useToast } from "@/components/toast/toast-provider";
import { assignBarcodes } from "@/app/(dashboard)/productos/barcode-actions";
import { INTERNAL_PREFIX, printableEan13 } from "@/lib/barcode";
import { cn, formatCurrency } from "@/lib/utils";

interface LabelProduct {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  products: LabelProduct[];
}

// Tamaños de etiqueta. En "hoja A4" se imprimen tantas como entren en la hoja
// (para cualquier impresora, y después se recortan); en "rollo" va una
// etiqueta por página, para etiqueteras térmicas.
const SIZES = {
  "50x30": { label: "50 × 30 mm", width: 50, height: 30 },
  "60x40": { label: "60 × 40 mm", width: 60, height: 40 },
  "70x37": { label: "70 × 37 mm", width: 70, height: 37 },
  "100x50": { label: "100 × 50 mm", width: 100, height: 50 },
} as const;
type SizeKey = keyof typeof SIZES;
type Output = "a4" | "roll";

// Hoja A4 con 5 mm de margen: 200 × 287 mm útiles.
const SHEET_MARGIN = 5;
const SHEET_WIDTH = 210 - SHEET_MARGIN * 2;
const SHEET_HEIGHT = 297 - SHEET_MARGIN * 2;
function labelsPerSheet(width: number, height: number) {
  const cols = Math.max(1, Math.floor(SHEET_WIDTH / width));
  const rows = Math.max(1, Math.floor(SHEET_HEIGHT / height));
  return { cols, rows, total: cols * rows };
}

const MAX_LABELS = 2000;

export function BarcodeLabelsDialog({ open, onClose, products }: Props) {
  const { showSuccess } = useToast();
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copies, setCopies] = useState(1);
  const [size, setSize] = useState<SizeKey>("50x30");
  const [output, setOutput] = useState<Output>("a4");
  const [showPrice, setShowPrice] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<Record<string, string>>({});
  const [printing, setPrinting] = useState(false);

  const codeOf = (p: LabelProduct) => newCodes[p.id] ?? p.barcode;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyMissing && (newCodes[p.id] ?? p.barcode)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (newCodes[p.id] ?? p.barcode ?? "").includes(q);
    });
  }, [products, search, onlyMissing, newCodes]);

  const selectedProducts = products.filter((p) => selected.has(p.id));
  const missing = selectedProducts.filter((p) => !codeOf(p));
  const printable = selectedProducts.filter((p) => printableEan13(codeOf(p)));
  const unprintable = selectedProducts.length - missing.length - printable.length;
  const totalLabels = printable.length * Math.max(1, copies);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = visible.every((p) => next.has(p.id));
      for (const p of visible) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  async function generateMissing() {
    setGenerating(true);
    setError(null);
    const res = await assignBarcodes(missing.map((p) => p.id));
    setGenerating(false);
    if (res.codes) {
      setNewCodes((current) => ({ ...current, ...res.codes }));
      const count = Object.keys(res.codes).length;
      if (count > 0) {
        showSuccess("Códigos generados", `${count} producto${count === 1 ? "" : "s"} ya tiene${count === 1 ? "" : "n"} su código de barras.`);
      }
    }
    if (res.error) setError(res.error);
  }

  function print() {
    if (printable.length === 0) return;
    if (totalLabels > MAX_LABELS) {
      setError(`Son demasiadas etiquetas juntas (máximo ${MAX_LABELS.toLocaleString("es-AR")}). Elegí menos productos o menos copias.`);
      return;
    }
    setError(null);
    setPrinting(true);
  }

  // Al mostrarse las etiquetas se abre el diálogo de impresión; al cerrarlo
  // (imprimiendo o cancelando) se sacan de la pantalla.
  useEffect(() => {
    if (!printing) return;
    const onAfter = () => setPrinting(false);
    window.addEventListener("afterprint", onAfter);
    const id = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", onAfter);
    };
  }, [printing]);

  const spec = SIZES[size];
  const sheet = output === "a4";
  const perSheet = labelsPerSheet(spec.width, spec.height);
  const sheetsNeeded = Math.ceil(totalLabels / perSheet.total);
  const labels = printing
    ? printable.flatMap((p) =>
        Array.from({ length: Math.max(1, copies) }, (_, i) => ({
          key: `${p.id}-${i}`,
          name: p.name,
          price: p.price,
          code: printableEan13(codeOf(p)) as string,
        }))
      )
    : [];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        title="Etiquetas con código de barras"
        description="Elegí los productos, generá el código de los que no tienen y imprimí las etiquetas."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto o código"
                className="pl-9"
              />
            </div>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Sin código
            </label>
            <Button variant="outline" onClick={selectVisible} disabled={visible.length === 0}>
              {visible.length > 0 && visible.every((p) => selected.has(p.id)) ? "Quitar la selección" : `Elegir los ${visible.length.toLocaleString("es-AR")} de la lista`}
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
            {visible.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay productos para mostrar.</p>
            ) : (
              <ul className="divide-y divide-border">
                {visible.slice(0, 300).map((p) => {
                  const code = codeOf(p);
                  const ok = printableEan13(code);
                  return (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            !code ? "text-warning" : ok ? "text-muted-foreground" : "text-danger"
                          )}
                        >
                          {!code ? "Sin código" : ok ? code : "No es EAN-13"}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {visible.length > 300 && (
                  <li className="px-3.5 py-2 text-center text-xs text-muted-foreground">
                    {`Se muestran 300 de ${visible.length.toLocaleString("es-AR")}. Usá el buscador para acotar.`}
                  </li>
                )}
              </ul>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {selectedProducts.length === 0
              ? "Todavía no elegiste productos."
              : `${selectedProducts.length.toLocaleString("es-AR")} elegido${selectedProducts.length === 1 ? "" : "s"}: ${printable.length.toLocaleString("es-AR")} listo${printable.length === 1 ? "" : "s"} para imprimir, ${missing.length.toLocaleString("es-AR")} sin código${unprintable > 0 ? `, ${unprintable} con un código que no se puede imprimir como etiqueta (no es EAN-13)` : ""}.`}
          </p>

          {missing.length > 0 && (
            <div className="rounded-xl bg-accent/40 p-3.5 text-sm">
              <p className="text-accent-foreground">
                {`Les generamos un código propio a los ${missing.length.toLocaleString("es-AR")} sin código. Empiezan con ${INTERNAL_PREFIX} (un rango que usan los negocios para códigos internos, así no se confunden con los de fábrica) y nunca se repiten en tu negocio.`}
              </p>
              <Button className="mt-2.5" onClick={() => void generateMissing()} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {`Generar ${missing.length.toLocaleString("es-AR")} código${missing.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lbl-output">Imprimir en</Label>
              <Select id="lbl-output" value={output} onChange={(e) => setOutput(e.target.value as Output)}>
                <option value="a4">Hoja A4 (varias por hoja)</option>
                <option value="roll">Rollo de etiquetera (una por etiqueta)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="lbl-size">Tamaño de la etiqueta</Label>
              <Select id="lbl-size" value={size} onChange={(e) => setSize(e.target.value as SizeKey)}>
                {Object.entries(SIZES).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="lbl-copies">Copias de cada una</Label>
              <Input
                id="lbl-copies"
                type="number"
                min={1}
                max={500}
                value={copies}
                onChange={(e) => setCopies(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <p className="self-end pb-2 text-xs text-muted-foreground">
              {sheet
                ? `Entran ${perSheet.total} por hoja (${perSheet.cols} × ${perSheet.rows}).${totalLabels > 0 ? ` Necesitás ${sheetsNeeded} hoja${sheetsNeeded === 1 ? "" : "s"}.` : ""}`
                : "Cada etiqueta sale en su propia página, del tamaño elegido."}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Mostrar el precio en la etiqueta
          </label>

          {error && <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">
              {totalLabels > 0 ? `${totalLabels.toLocaleString("es-AR")} etiqueta${totalLabels === 1 ? "" : "s"}` : ""}
            </span>
            <Button onClick={print} disabled={printable.length === 0}>
              <Printer className="h-4 w-4" />
              Imprimir etiquetas
            </Button>
          </div>
        </div>
      </Dialog>

      {printing &&
        createPortal(
          <div className="label-print-root">
            <style>{`
              .label-print-root { display: none; }
              @media print {
                body > *:not(.label-print-root) { display: none !important; }
                .label-print-root { display: ${sheet ? "grid" : "block"} !important; background: #fff; color: #000; }
                @page { size: ${sheet ? "A4" : `${spec.width}mm ${spec.height}mm`}; margin: ${sheet ? `${SHEET_MARGIN}mm` : "0"}; }
                ${
                  sheet
                    ? `.label-print-root { grid-template-columns: repeat(${perSheet.cols}, ${spec.width}mm); grid-auto-rows: ${spec.height}mm; gap: 0; justify-content: start; align-content: start; }`
                    : ""
                }
                .label-print-item { width: ${spec.width}mm; height: ${spec.height}mm; box-sizing: border-box; padding: 1.5mm 2mm; overflow: hidden; break-inside: avoid; page-break-after: ${sheet ? "auto" : "always"}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-family: Arial, sans-serif; ${sheet ? "outline: 0.1mm dashed #bbb;" : ""} }
                .label-print-name { font-size: ${spec.height >= 40 ? 10 : 8}pt; font-weight: 700; line-height: 1.1; max-height: 2.3em; overflow: hidden; width: 100%; }
                .label-print-price { font-size: ${spec.height >= 40 ? 13 : 10}pt; font-weight: 700; margin-top: 0.5mm; }
                .label-print-item svg { width: 100%; height: auto; max-height: ${Math.round(spec.height * 0.55)}mm; }
              }
            `}</style>
            {labels.map((l) => (
              <div key={l.key} className="label-print-item">
                <div className="label-print-name">{l.name}</div>
                <Ean13Svg code={l.code} />
                {showPrice && <div className="label-print-price">{formatCurrency(l.price)}</div>}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
