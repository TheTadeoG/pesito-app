"use client";

import { useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, Plus, Search, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  saveProduct,
  createBrandQuick,
  type ProductFormInput,
  type SaveProductResult,
} from "@/app/(dashboard)/productos/actions";
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

const MAX_IMAGE_MB = 5;

type BrandOption = Pick<Brand, "id" | "name">;

type SupplierOption = Pick<Supplier, "id" | "name">;

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  brands?: BrandOption[];
  suppliers?: SupplierOption[];
  onSaved?: (product: NonNullable<SaveProductResult["product"]>, initialStock: number) => void;
  onBrandCreated?: (brand: BrandOption) => void;
  // Cuando el alta viene desde Compras: la cantidad ingresada no se guarda
  // como stock directo del producto (quedaría en 0), sino que se devuelve
  // vía onSaved para que el que llama la cargue como línea de esa compra —
  // así el stock inicial entra por un único camino (la compra) y no se
  // duplica sumando el "stock inicial" del alta más la compra en sí.
  initialStockAsPurchase?: boolean;
}

export function ProductForm({
  open,
  onClose,
  product,
  brands = [],
  suppliers = [],
  onSaved,
  onBrandCreated,
  initialStockAsPurchase = false,
}: ProductFormProps) {
  const isEdit = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
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
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [cost, setCost] = useState(String(product?.cost ?? ""));
  const [stock, setStock] = useState(String(product?.stock ?? "0"));
  const [minStock, setMinStock] = useState(String(product?.min_stock ?? "0"));
  const [unit, setUnit] = useState(product?.unit ?? "u");
  const [defaultSupplierId, setDefaultSupplierId] = useState<string | null>(
    product?.default_supplier_id ?? null
  );
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

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setImageError("Elegí un archivo de imagen.");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setImageError(`La imagen no puede pesar más de ${MAX_IMAGE_MB}MB.`);
      return;
    }

    setImageError(null);
    setUploadingImage(true);

    const supabase = createClient();
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, upsert: true });

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const enteredStock = Number(stock) || 0;
    const input: ProductFormInput = {
      id: product?.id,
      name,
      brand: selectedBrandName ?? "",
      barcode,
      sku,
      price: Number(price) || 0,
      cost: cost ? Number(cost) : null,
      stock: initialStockAsPurchase ? 0 : enteredStock,
      minStock: Number(minStock) || 0,
      unit,
      active: product?.active ?? true,
      imageUrl,
      defaultSupplierId,
    };

    const result = await saveProduct(input);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.product) onSaved?.(result.product, enteredStock);
    resetAndClose();
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      title={isEdit ? "Editar producto" : "Nuevo producto"}
      description={isEdit ? product?.name : "Sumá un producto a tu catálogo."}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="p-name">Nombre</Label>
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
                  className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Sin marca
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
                    placeholder="Buscar marca…"
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="p-barcode">Código de barras</Label>
            <Input id="p-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-sku">SKU</Label>
            <Input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="p-price">Precio de venta</Label>
            <Input
              id="p-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="p-cost">Costo (opcional)</Label>
            <Input
              id="p-cost"
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="p-stock">
              {initialStockAsPurchase ? "Cantidad a recibir" : "Stock inicial"}
            </Label>
            <Input
              id="p-stock"
              type="number"
              step="0.01"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              disabled={isEdit}
            />
          </div>
          <div>
            <Label htmlFor="p-min">Stock mínimo</Label>
            <Input
              id="p-min"
              type="number"
              step="0.01"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="p-unit">Unidad</Label>
            <Select id="p-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="p-supplier">Proveedor habitual (opcional)</Label>
          <Select
            id="p-supplier"
            value={defaultSupplierId ?? ""}
            onChange={(e) => setDefaultSupplierId(e.target.value || null)}
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
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
          <Button type="submit" disabled={pending || uploadingImage}>
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
    </Dialog>
  );
}
