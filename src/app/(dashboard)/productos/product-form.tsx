"use client";

import { markCatalogDirty } from "@/lib/pos-catalog-store";
import { useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, Plus, Search, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { PlainVariantsTab } from "@/app/(dashboard)/productos/plain-variants-tab";
import { GroupVariantsTab, type RowEdits } from "@/app/(dashboard)/productos/group-variants-tab";
import { baseNameOf } from "@/app/(dashboard)/productos/variant-group-rows";
import { EMPTY_VARIANTS, VariantsSection, resolveVariantRows, toVariantInputs, type VariantsState } from "@/app/(dashboard)/productos/variants-section";
import {
  saveProduct,
  saveProductWithVariants,
  saveVariantGroup,
  addVariantsToProduct,
  createBrandQuick,
  suggestSku,
  createSupplierQuick,
  type ProductFormInput,
  type SaveProductResult,
} from "@/app/(dashboard)/productos/actions";
import { baseSkuOf, variantName } from "@/lib/variants";
import { MarketHintNote } from "@/app/(dashboard)/productos/market-hint";
import { generateBarcode } from "@/app/(dashboard)/productos/barcode-actions";
import { featureLockedMessage } from "@/lib/plan-access";
import type { Brand, Product, Supplier } from "@/lib/types";

const units = [
  { value: "u", label: "Unidad" },
  { value: "kg", label: "Kilogramo" },
  { value: "g", label: "Gramo" },
  { value: "l", label: "Litro" },
  { value: "ml", label: "Mililitro" },
  { value: "pack", label: "Pack" },
  { value: "caja", label: "Caja" },
];

// Lo que se sube (ya achicado en el navegador) y lo que se acepta de entrada
// (una foto de celular pesa varios MB y se achica antes de subir).
const MAX_IMAGE_MB = 5;
const MAX_ORIGINAL_IMAGE_MB = 20;

// Alícuotas de IVA vigentes en Argentina — sólo para la calculadora de
// abajo, no se persiste en el producto: lo único que se guarda siempre es
// el valor final (precio o costo), igual que antes de tener este ayudante.
const IVA_RATES = [
  { value: "21", label: "21%" },
  { value: "10.5", label: "10,5%" },
  { value: "27", label: "27%" },
  { value: "0", label: "Exento / 0%" },
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Poner el precio como un porcentaje de ganancia sobre el costo (la misma cuenta del aviso de margen bajo): se escribe
// el %, se ve en cuánto queda el precio y se aplica con un botón. Sólo ayuda: lo que se guarda es el precio final.
function PriceFromCost({ cost, price, onUse }: { cost: string; price: string; onUse: (value: string) => void }) {
  const [percent, setPercent] = useState("");
  const c = Number(cost);
  if (cost.trim() === "" || Number.isNaN(c) || c <= 0) return null;
  const p = Number(percent);
  const valid = percent.trim() !== "" && !Number.isNaN(p) && p > -100;
  const result = valid ? round2(c * (1 + p / 100)) : null;
  const current = Number(price);
  const currentPct = price.trim() !== "" && current > 0 ? (current / c - 1) * 100 : null;
  return (
    <div className="-mt-1 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36">
          <Label htmlFor="p-markup">Ganancia sobre el costo (%)</Label>
          <Input id="p-markup" type="number" step="0.1" min={0} value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="Ej: 40" />
        </div>
        <div className="min-w-0 flex-1 pb-1.5 text-sm">
          {result !== null ? (
            <p className="text-foreground">
              {`Con ${p.toLocaleString("es-AR")}% sobre ${formatCurrency(c)} el precio queda en `}
              <b>{formatCurrency(result)}</b>
              <span className="text-muted-foreground">{` (ganás ${formatCurrency(round2(result - c))} por unidad)`}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Escribí un porcentaje y te mostramos en cuánto queda el precio.</p>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" disabled={result === null} onClick={() => result !== null && onUse(String(result))}>
          Usar este precio
        </Button>
      </div>
      {currentPct !== null && (
        <p className="mt-2 text-xs text-muted-foreground">{`Con el precio actual ganás ${currentPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% sobre el costo.`}</p>
      )}
    </div>
  );
}

// Ayudante opcional para no tener que sacar cuentas a mano: mostrás el
// precio final como siempre, o desplegás la calculadora y cargás el
// precio sin IVA — el final se recalcula solo según la alícuota elegida.
function PriceWithIvaField({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [showIva, setShowIva] = useState(true);
  const [ivaRate, setIvaRate] = useState("21");
  // Al editar un producto ya cargado, "value" trae el precio final desde
  // el arranque — sin este cálculo inicial, "Sin IVA" quedaría vacío
  // mientras "Final" ya muestra el precio, como si faltara completar algo.
  const [net, setNet] = useState(() => {
    const f = Number(value);
    if (value.trim() === "" || Number.isNaN(f)) return "";
    return String(round2(f / (1 + 21 / 100)));
  });

  function recalcFromNet(nextNet: string) {
    setNet(nextNet);
    const n = Number(nextNet);
    if (nextNet.trim() === "" || Number.isNaN(n)) {
      onChange("");
      return;
    }
    onChange(String(round2(n * (1 + Number(ivaRate) / 100))));
  }

  function recalcFromFinal(nextFinal: string) {
    onChange(nextFinal);
    const f = Number(nextFinal);
    if (nextFinal.trim() === "" || Number.isNaN(f)) {
      setNet("");
      return;
    }
    setNet(String(round2(f / (1 + Number(ivaRate) / 100))));
  }

  function handleRateChange(nextRate: string) {
    setIvaRate(nextRate);
    // El final es lo que en verdad se guarda, así que cambiar la
    // alícuota recalcula el neto mostrado, nunca al revés.
    const f = Number(value);
    if (value.trim() !== "" && !Number.isNaN(f)) {
      setNet(String(round2(f / (1 + Number(nextRate) / 100))));
    }
  }

  return (
    <div data-tour={id}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
        <button
          type="button"
          onClick={() => setShowIva((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showIva ? "Ocultar IVA" : "Calcular con IVA"}
        </button>
      </div>

      {showIva ? (
        <div className="mt-1.5 space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          <Select value={ivaRate} onChange={(e) => handleRateChange(e.target.value)}>
            {IVA_RATES.map((r) => (
              <option key={r.value} value={r.value}>
                Alícuota {r.label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">Sin IVA</p>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={net}
                onChange={(e) => recalcFromNet(e.target.value)}
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">Final (con IVA)</p>
              <Input
                id={id}
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => recalcFromFinal(e.target.value)}
                required={required}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Se guarda y se cobra el precio final (con IVA). La alícuota sólo ayuda a calcularlo.</p>
        </div>
      ) : (
        <Input
          id={id}
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}
    </div>
  );
}

type BrandOption = Pick<Brand, "id" | "name">;

type SupplierOption = Pick<Supplier, "id" | "name">;

interface ProductFormProps {
  /** Las imágenes se guardan en la carpeta del negocio (ver migración 0045). */
  orgId: string;
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  brands?: BrandOption[];
  suppliers?: SupplierOption[];
  onSaved?: (product: NonNullable<SaveProductResult["product"]>, initialStock: number) => void;
  onBrandCreated?: (brand: BrandOption) => void;
  onSupplierCreated?: (supplier: SupplierOption) => void;
  // Cuando el alta viene desde Compras: la cantidad ingresada no se guarda
  // como stock directo del producto (quedaría en 0), sino que se devuelve
  // vía onSaved para que el que llama la cargue como línea de esa compra —
  // así el stock inicial entra por un único camino (la compra) y no se
  // duplica sumando el "stock inicial" del alta más la compra en sí.
  initialStockAsPurchase?: boolean;
  /** Botón "Generar" junto al código de barras (Plan Básico); `locked` si el plan no lo incluye. */
  barcodeGenerate?: { locked: boolean };
  /** Talles y colores: sólo al crear. `locked` si el plan no los incluye; las sugerencias salen de lo que ya se usó. */
  variantsConfig?: { locked: boolean; sizeSuggestions: string[]; colorSuggestions: string[] };
  /** Al editar un producto con variantes: todas las de su grupo. El formulario pasa a tener las solapas "Datos" y "Talles y colores". */
  groupMembers?: Product[];
  /** Solapa con la que abre el formulario de un producto con variantes. */
  initialTab?: "datos" | "variantes";
}

export function ProductForm({
  orgId,
  open,
  onClose,
  product,
  brands = [],
  suppliers = [],
  onSaved,
  onBrandCreated,
  onSupplierCreated,
  initialStockAsPurchase = false,
  barcodeGenerate,
  variantsConfig,
  groupMembers,
  initialTab,
}: ProductFormProps) {
  const isEdit = Boolean(product);
  const groupMode = Boolean(product?.variant_group_id) && (groupMembers?.length ?? 0) > 0;
  // Al editar cualquier producto: solapas "Producto" y "Variantes".
  const tabbed = isEdit && Boolean(variantsConfig);
  const [tab, setTab] = useState<"datos" | "variantes">(initialTab ?? "datos");
  const onVariantsTab = tabbed && tab === "variantes";
  const [ownSize, setOwnSize] = useState("");
  const [ownColor, setOwnColor] = useState("");
  const [rowEdits, setRowEdits] = useState<RowEdits>({});
  const [newVariants, setNewVariants] = useState<VariantsState>({ ...EMPTY_VARIANTS, enabled: true });
  const [costTouched, setCostTouched] = useState(false);

  async function handleGenerateBarcode() {
    if (barcodeGenerate?.locked) {
      setBarcodeNote(featureLockedMessage("barcodeLabels"));
      return;
    }
    setGeneratingBarcode(true);
    setBarcodeNote(null);
    const res = await generateBarcode();
    setGeneratingBarcode(false);
    if (res.code) setBarcode(res.code);
    else setBarcodeNote(res.error ?? "No pudimos generar el código.");
  }
  const [generatingSku, setGeneratingSku] = useState(false);
  async function handleGenerateSku() {
    setGeneratingSku(true);
    setSku(await suggestSku());
    setGeneratingSku(false);
  }
  const [name, setName] = useState(product ? (groupMode ? baseNameOf(product) : product.name) : "");
  const [variants, setVariants] = useState<VariantsState>(EMPTY_VARIANTS);
  // Al editar una variante: su talle y color (el nombre acompaña el cambio).
  const isVariant = Boolean(product?.variant_group_id);
  const [variantSize, setVariantSize] = useState(product?.variant_size ?? "");
  const [variantColor, setVariantColor] = useState(product?.variant_color ?? "");
  const variantsOn = !isEdit && Boolean(variantsConfig) && !variantsConfig?.locked && variants.enabled;
  const [selectedBrandName, setSelectedBrandName] = useState<string | null>(
    product?.brand ?? null
  );
  const [brandQuery, setBrandQuery] = useState("");
  const [browseBrands, setBrowseBrands] = useState(false);
  const [localBrands, setLocalBrands] = useState(brands);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [barcodeNote, setBarcodeNote] = useState<string | null>(null);
  const [sku, setSku] = useState(product?.sku ?? "");
  const [priceKey, setPriceKey] = useState(0);
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [cost, setCostValue] = useState(String(product?.cost ?? ""));
  const setCost = (v: string) => {
    setCostTouched(true);
    setCostValue(v);
  };
  const [stock, setStock] = useState(String(product?.stock ?? "0"));
  const [minStock, setMinStock] = useState(String(product?.min_stock ?? "0"));
  const [unit, setUnit] = useState(product?.unit ?? "u");
  const [packageLabel, setPackageLabel] = useState(product?.package_label ?? "");
  const [packSize, setPackSize] = useState(
    product?.pack_size !== null && product?.pack_size !== undefined ? String(product.pack_size) : ""
  );
  const [defaultSupplierId, setDefaultSupplierId] = useState<string | null>(
    product?.default_supplier_id ?? null
  );
  const [localSuppliers, setLocalSuppliers] = useState(suppliers);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brandResults = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return browseBrands ? localBrands.slice(0, 50) : [];
    return localBrands.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 50);
  }, [localBrands, brandQuery, browseBrands]);

  function resetAndClose() {
    onClose();
  }

  async function uploadFile(picked: File) {
    let file = picked;
    if (!file.type.startsWith("image/")) {
      setImageError("Elegí un archivo de imagen.");
      return;
    }
    if (file.size > MAX_ORIGINAL_IMAGE_MB * 1024 * 1024) {
      setImageError(`La imagen no puede pesar más de ${MAX_ORIGINAL_IMAGE_MB}MB.`);
      return;
    }

    setImageError(null);
    setUploadingImage(true);

    file = await compressImage(file);
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setUploadingImage(false);
      setImageError(`La imagen no puede pesar más de ${MAX_IMAGE_MB}MB.`);
      return;
    }

    const supabase = createClient();
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${orgId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
        // Cada foto sube con un nombre nuevo (uuid): el navegador y la CDN la guardan un año.
        cacheControl: "31536000",
      });

    setUploadingImage(false);

    if (uploadError) {
      setImageError("No pudimos subir la imagen.");
      return;
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadFile(file);
  }

  function handleImageDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setImageDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  async function handleCreateBrand() {
    const name = newBrandName.trim();
    if (!name) {
      setBrandError("Ingresá un nombre.");
      return;
    }
    setCreatingBrand(true);
    setBrandError(null);
    const result = await createBrandQuick(name);
    setCreatingBrand(false);
    if (result.error || !result.id) {
      setBrandError(result.error ?? "No pudimos crear la marca.");
      return;
    }
    const newBrand: BrandOption = { id: result.id, name };
    setLocalBrands((current) => [...current, newBrand]);
    onBrandCreated?.(newBrand);
    setSelectedBrandName(name);
    setBrandQuery("");
    setBrowseBrands(false);
    setNewBrandName("");
    setShowNewBrand(false);
  }

  async function handleCreateSupplier() {
    const name = newSupplierName.trim();
    if (!name) {
      setSupplierError("Ingresá un nombre.");
      return;
    }
    setCreatingSupplier(true);
    setSupplierError(null);
    const result = await createSupplierQuick(name);
    setCreatingSupplier(false);
    if (result.error || !result.id) {
      setSupplierError(result.error ?? "No pudimos crear el proveedor.");
      return;
    }
    const newSupplier: SupplierOption = { id: result.id, name };
    setLocalSuppliers((current) => [...current, newSupplier]);
    onSupplierCreated?.(newSupplier);
    setDefaultSupplierId(result.id);
    setNewSupplierName("");
    setShowNewSupplier(false);
  }

  const priceBelowCost =
    cost.trim() !== "" && price.trim() !== "" && Number(price) > 0 && Number(price) < Number(cost);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    if (groupMode && product?.variant_group_id && groupMembers) {
      const groupId = product.variant_group_id;
      const rowsToSave = groupMembers.map((m) => {
        const e = rowEdits[m.id] ?? {};
        return { id: m.id, size: e.size ?? m.variant_size ?? "", color: e.color ?? m.variant_color ?? "", sku: e.sku ?? m.sku, barcode: e.barcode ?? m.barcode ?? "", price: Number(e.price ?? m.price) || 0 };
      });
      const res = await saveVariantGroup(
        groupId,
        {
          name,
          brand: selectedBrandName ?? "",
          ...(costTouched ? { cost: cost ? Number(cost) : null } : {}),
          minStock: Number(minStock) || 0,
          unit,
          packageLabel,
          packSize,
          hadPackSize: product.pack_size !== null && product.pack_size !== undefined,
          imageUrl,
          defaultSupplierId,
        },
        rowsToSave
      );
      if (res.error) {
        setPending(false);
        setError(res.error);
        return;
      }
      const newRows = variantsConfig?.locked ? [] : resolveVariantRows(newVariants, baseSkuOf(product.sku, product.variant_size ?? "", product.variant_color ?? ""), String(product.price), groupMembers.map((m) => `${(m.variant_size ?? "").toLowerCase()}|${(m.variant_color ?? "").toLowerCase()}`));
      if (newRows.length > 0) {
        const add = await addVariantsToProduct(product.id, null, toVariantInputs(newRows));
        markCatalogDirty();
        setPending(false);
        if (add.error) {
          setError(`Guardamos los cambios, pero las variantes nuevas fallaron: ${add.error}`);
          if (!add.created) return;
        }
        resetAndClose();
        return;
      }
      markCatalogDirty();
      setPending(false);
      resetAndClose();
      return;
    }

    if (variantsOn) {
      const rows = resolveVariantRows(variants, sku, price);
      if (rows.length === 0) {
        setPending(false);
        setError("Escribí al menos un talle o un color para armar las variantes.");
        return;
      }
      const res = await saveProductWithVariants(
        {
          name,
          brand: selectedBrandName ?? "",
          minStock: Number(minStock) || 0,
          cost: cost ? Number(cost) : null,
          unit,
          packageLabel,
          packSize,
          hadPackSize: false,
          active: true,
          imageUrl,
          defaultSupplierId,
        },
        toVariantInputs(rows).map((v) => ({ ...v, stock: initialStockAsPurchase ? 0 : v.stock }))
      );
      markCatalogDirty();
      setPending(false);
      if (res.error) {
        setError(res.error);
        // Si las variantes se crearon pero falló el stock, se avisa y se cierra igual.
        if (!res.created) return;
      }
      resetAndClose();
      return;
    }

    // Al editar una variante, el nombre acompaña el cambio de talle o color.
    let finalName = name;
    if (isVariant && product) {
      const oldSuffix = variantName("", product.variant_size ?? "", product.variant_color ?? "").replace(/^ · /, "");
      const newSuffix = variantName("", variantSize, variantColor).replace(/^ · /, "");
      if (oldSuffix !== newSuffix && oldSuffix && name.endsWith(` · ${oldSuffix}`)) {
        finalName = `${name.slice(0, name.length - oldSuffix.length - 3)}${newSuffix ? ` · ${newSuffix}` : ""}`;
      }
    }

    // Producto sin variantes al que se le suman talles y colores desde la solapa "Variantes".
    const plainRows =
      isEdit && !isVariant && product && variantsConfig && !variantsConfig.locked
        ? resolveVariantRows(newVariants, sku, price, [`${ownSize.trim().toLowerCase()}|${ownColor.trim().toLowerCase()}`])
        : [];
    if (plainRows.length > 0 && !ownSize.trim() && !ownColor.trim()) {
      setPending(false);
      setTab("variantes");
      setError("En la solapa Variantes, decinos qué talle o color es este producto.");
      return;
    }

    const enteredStock = Number(stock) || 0;
    const input: ProductFormInput = {
      id: product?.id,
      name: finalName,
      brand: selectedBrandName ?? "",
      barcode,
      sku,
      price: Number(price) || 0,
      cost: cost ? Number(cost) : null,
      stock: initialStockAsPurchase ? 0 : enteredStock,
      minStock: Number(minStock) || 0,
      unit,
      packageLabel,
      packSize,
      hadPackSize: product?.pack_size !== null && product?.pack_size !== undefined,
      active: product?.active ?? true,
      imageUrl,
      defaultSupplierId,
      ...(isVariant ? { variantSize, variantColor } : {}),
    };

    const result = await saveProduct(input);
    if (!result.error) markCatalogDirty();
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (plainRows.length > 0 && product) {
      setPending(true);
      const add = await addVariantsToProduct(product.id, { size: ownSize, color: ownColor }, toVariantInputs(plainRows));
      markCatalogDirty();
      setPending(false);
      if (add.error) {
        setTab("variantes");
        setError(`Guardamos los cambios del producto, pero las variantes fallaron: ${add.error}`);
        if (!add.created) return;
      }
    }

    if (result.product) onSaved?.(result.product, enteredStock);
    resetAndClose();
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      title={isEdit ? "Editar producto" : "Nuevo producto"}
      description={isEdit ? (groupMode && product ? baseNameOf(product) : product?.name) : "Sumá un producto a tu catálogo."}
      size="lg"
    >
      <form data-tour="product-form" onSubmit={handleSubmit} className="space-y-4">
        {tabbed && (
          <div role="tablist" aria-label="Secciones del producto" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
            {([
              ["datos", "Producto"],
              ["variantes", groupMode ? `Variantes · ${groupMembers?.length ?? 0}` : "Variantes"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {onVariantsTab && groupMode && groupMembers && (
          <GroupVariantsTab
            members={groupMembers}
            edits={rowEdits}
            onEdit={(id, field, value) => setRowEdits((cur) => ({ ...cur, [id]: { ...cur[id], [field]: value } }))}
            onEditMany={(field, value) =>
              setRowEdits((cur) => {
                const next = { ...cur };
                for (const m of groupMembers) next[m.id] = { ...next[m.id], [field]: value };
                return next;
              })
            }
            newVariants={newVariants}
            onNewVariantsChange={setNewVariants}
            locked={Boolean(variantsConfig?.locked)}
            sizeSuggestions={variantsConfig?.sizeSuggestions ?? []}
            colorSuggestions={variantsConfig?.colorSuggestions ?? []}
          />
        )}
        {onVariantsTab && !groupMode && variantsConfig && (
          <PlainVariantsTab
            name={name}
            sku={sku}
            price={price}
            ownSize={ownSize}
            ownColor={ownColor}
            onOwnChange={(sz, co) => {
              setOwnSize(sz);
              setOwnColor(co);
            }}
            state={newVariants}
            onChange={setNewVariants}
            locked={variantsConfig.locked}
            sizeSuggestions={variantsConfig.sizeSuggestions}
            colorSuggestions={variantsConfig.colorSuggestions}
          />
        )}
        <div className={cn("space-y-4", onVariantsTab && "hidden")}>
        <div className="flex items-start gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setImageDragActive(true);
            }}
            onDragLeave={() => setImageDragActive(false)}
            onDrop={handleImageDrop}
            disabled={uploadingImage}
            className={cn(
              "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/50 text-muted-foreground transition-colors",
              imageDragActive ? "border-primary bg-accent" : "border-border hover:border-primary/50"
            )}
          >
            {uploadingImage ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6" />
            )}
          </button>
          <div className="min-w-0 flex-1 space-y-1.5 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              {imageUrl ? "Cambiar imagen" : "Subir imagen"}
            </Button>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-danger"
              >
                <X className="h-3 w-3" />
                Quitar
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              Arrastrá una imagen acá o hacé click para elegirla.
            </p>
            {imageError && <p className="text-xs text-danger">{imageError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="p-name" required>
              Nombre
            </Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="p-brand">Marca</Label>
            {selectedBrandName ? (
              <div className="flex h-10 items-center justify-between rounded-xl border border-border px-3.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {selectedBrandName}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBrandName(null);
                    setBrandQuery("");
                  }}
                  aria-label="Quitar marca"
                  title="Quitar marca"
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setBrowseBrands((v) => !v)}
                    aria-label="Ver todas las marcas"
                    title="Ver todas las marcas"
                    className="absolute left-3.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <Input
                    id="p-brand"
                    value={brandQuery}
                    onChange={(e) => setBrandQuery(e.target.value)}
                    onFocus={() => setBrowseBrands(true)}
                    placeholder="Buscar marca… (o mirá la lista)"
                    className="pl-10"
                  />
                  {(brandQuery.trim() || browseBrands) && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                      {brandResults.length === 0 && (
                        <p className="px-3.5 py-2.5 text-sm text-muted-foreground">
                          {brandQuery.trim()
                            ? `No encontramos marcas que coincidan con "${brandQuery}". Podés cargarla con el botón +.`
                            : "Todavía no cargaste marcas."}
                        </p>
                      )}
                      {brandResults.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setSelectedBrandName(b.name);
                            setBrandQuery("");
                            setBrowseBrands(false);
                          }}
                          className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-muted"
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Cargar marca nueva"
                  onClick={() => {
                    setNewBrandName(brandQuery);
                    setBrandError(null);
                    setShowNewBrand(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {!groupMode && (
        <div className="grid grid-cols-2 gap-3">
          {!variantsOn && (
          <div>
            <Label htmlFor="p-barcode">Código de barras (opcional)</Label>
            <div className="flex gap-2">
              <Input id="p-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              {barcodeGenerate && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleGenerateBarcode()}
                  disabled={generatingBarcode}
                  title="Genera un código propio que no se repite"
                >
                  {generatingBarcode ? "…" : "Generar"}
                </Button>
              )}
            </div>
            {barcodeNote && <p className="mt-1 text-xs text-warning">{barcodeNote}</p>}
          </div>
          )}
          <div>
            <Label htmlFor="p-sku" required>
              {variantsOn ? "SKU base" : "SKU"}
            </Label>
            <div className="flex gap-2">
              <Input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={60} required placeholder="Código propio, único" />
              <Button type="button" variant="outline" onClick={() => void handleGenerateSku()} disabled={generatingSku} title="Genera el próximo SKU libre (P-00001, P-00002…)">
                {generatingSku ? "…" : "Generar"}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{variantsOn ? "De acá se arma el SKU de cada variante." : "Identifica al producto: no se puede repetir."}</p>
          </div>
        </div>
        )}
        {!groupMode && <MarketHintNote barcode={barcode} price={price} cost={cost} onUse={(v) => {
          setPrice(v);
          setPriceKey((k) => k + 1); // rearma «Sin IVA» con el precio nuevo
        }}
        />}
        {!variantsOn && !groupMode && (
          <p className="-mt-2 text-xs text-muted-foreground">
            El código de barras lo podés escanear con un lector en el campo de arriba, o cargarlo a
            mano si no tenés lector.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!groupMode && (
          <PriceWithIvaField
            key={priceKey}
            id="p-price"
            label="Precio de venta"
            value={price}
            onChange={setPrice}
            required
          />
          )}
          <PriceWithIvaField id="p-cost" label={groupMode ? "Costo de todas las variantes (opcional)" : "Costo (opcional)"} value={cost} onChange={setCost} />
        </div>
        {groupMode && (
          <p className="-mt-2 text-xs text-muted-foreground">
            El SKU, el código de barras y el precio de cada variante se editan en la solapa “Variantes”. El costo se aplica a todas sólo si lo cambiás.
          </p>
        )}
        {!groupMode && <PriceFromCost
          cost={cost}
          price={price}
          onUse={(v) => {
            setPrice(v);
            setPriceKey((k) => k + 1); // rearma «Sin IVA» con el precio nuevo
          }}
        />}
        {priceBelowCost && !groupMode && (
          <p className="-mt-2 rounded-xl bg-danger-bg px-3 py-2 text-xs font-medium text-danger">
            El precio de venta es menor al costo: estarías vendiendo a pérdida.
          </p>
        )}

        {!isEdit && variantsConfig && (
          <VariantsSection
            state={variants}
            onChange={setVariants}
            locked={variantsConfig.locked}
            baseName={name}
            baseSku={sku}
            basePrice={price}
            sizeSuggestions={variantsConfig.sizeSuggestions}
            colorSuggestions={variantsConfig.colorSuggestions}
            showStock={!initialStockAsPurchase}
          />
        )}

        {isVariant && !groupMode && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
            <p className="col-span-2 text-xs text-muted-foreground">Es una variante de un producto con talles o colores: cada una tiene su SKU, stock y precio.</p>
            <div>
              <Label htmlFor="p-vsize">Talle</Label>
              <Input id="p-vsize" value={variantSize} onChange={(e) => setVariantSize(e.target.value)} maxLength={40} placeholder="Ej: M" />
            </div>
            <div>
              <Label htmlFor="p-vcolor">Color</Label>
              <Input id="p-vcolor" value={variantColor} onChange={(e) => setVariantColor(e.target.value)} maxLength={40} placeholder="Ej: Azul" />
            </div>
          </div>
        )}

        <div data-tour="p-stock" className={cn("grid gap-3", variantsOn || groupMode ? "grid-cols-2" : "grid-cols-3")}>
          {!variantsOn && !groupMode && (
          <div>
            <Label htmlFor="p-stock" className="flex min-h-9 items-end">
              {initialStockAsPurchase ? "Cantidad a recibir" : "Stock inicial (opcional)"}
            </Label>
            <Input
              id="p-stock"
              type="number"
              step="0.01"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              disabled={isEdit}
            />
          </div>
          )}
          <div>
            <Label htmlFor="p-min" className="flex min-h-9 items-end">
              Stock mínimo (opcional)
            </Label>
            <Input
              id="p-min"
              type="number"
              step="0.01"
              min={0}
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="p-unit" className="flex min-h-9 items-end">
              Cómo lo vendés
            </Label>
            <Select id="p-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Elegí si lo vendés por unidad, por peso (kg/g) o por volumen (l/ml). El stock y el mínimo
          se manejan en esa misma medida.
        </p>

        <div>
          <Label htmlFor="p-package">Presentación (opcional)</Label>
          <Input
            id="p-package"
            value={packageLabel}
            onChange={(e) => setPackageLabel(e.target.value)}
            placeholder="Ej: Pack de 6, Fardo de 12, Docena"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Si viene agrupado (pack, fardo, docena), aclaralo acá para que se entienda al vender.
          </p>
        </div>

        <div>
          <Label htmlFor="p-pack">Unidades por bulto del proveedor (opcional)</Label>
          <Input
            id="p-pack"
            type="number"
            min={0}
            step="any"
            value={packSize}
            onChange={(e) => setPackSize(e.target.value)}
            placeholder="Ej: 12"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Si tu proveedor lo vende en cajas, fardos o packs, poné cuántas unidades trae cada uno. Las
            recomendaciones de compra piden bultos enteros.
          </p>
        </div>

        <div>
          <Label htmlFor="p-supplier">Proveedor habitual (opcional)</Label>
          <div className="flex gap-2">
            <Select
              id="p-supplier"
              value={defaultSupplierId ?? ""}
              onChange={(e) => setDefaultSupplierId(e.target.value || null)}
              className="flex-1"
            >
              <option value="">Sin proveedor</option>
              {localSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Cargar proveedor nuevo"
              onClick={() => {
                setNewSupplierName("");
                setSupplierError(null);
                setShowNewSupplier(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        </div>

        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Para cambiar el stock usá los ajustes desde Inventario.
          </p>
        )}
        {!isEdit && initialStockAsPurchase && (
          <p className="text-xs text-muted-foreground">
            Esta cantidad se agrega como línea de esta compra, no como stock directo — así no se
            carga dos veces.
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" data-tour="product-save" disabled={pending || uploadingImage}>
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </div>
      </form>

      <Dialog
        open={showNewBrand}
        onClose={() => {
          setShowNewBrand(false);
          setBrandError(null);
        }}
        title="Nueva marca"
        description="Cargá una marca para poder reutilizarla en otros productos."
      >
        <div className="space-y-4">
          <Input
            autoFocus
            value={newBrandName}
            onChange={(e) => setNewBrandName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creatingBrand) {
                e.preventDefault();
                handleCreateBrand();
              }
            }}
            placeholder="Nombre de la marca"
          />
          {brandError && (
            <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{brandError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowNewBrand(false);
                setBrandError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={creatingBrand || !newBrandName.trim()}
              onClick={handleCreateBrand}
            >
              {creatingBrand ? "Guardando…" : "Crear y seleccionar"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={showNewSupplier}
        onClose={() => {
          setShowNewSupplier(false);
          setSupplierError(null);
        }}
        title="Nuevo proveedor"
        description="Cargá un proveedor sin salir del alta del producto."
      >
        <div className="space-y-4">
          <Input
            autoFocus
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creatingSupplier) {
                e.preventDefault();
                handleCreateSupplier();
              }
            }}
            placeholder="Nombre del proveedor"
          />
          {supplierError && (
            <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              {supplierError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowNewSupplier(false);
                setSupplierError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={creatingSupplier || !newSupplierName.trim()}
              onClick={handleCreateSupplier}
            >
              {creatingSupplier ? "Guardando…" : "Crear y seleccionar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Dialog>
  );
}
