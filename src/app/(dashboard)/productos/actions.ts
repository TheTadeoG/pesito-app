"use server";

import { checkRateLimit } from "@/lib/rate-limit";
import { checkProductLimit } from "@/lib/plan-limits";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { getBranchContext } from "@/lib/branches";
import { formatCurrency } from "@/lib/utils";
import { variantName } from "@/lib/variants";

export interface ProductFormInput {
  id?: string;
  name: string;
  brand: string;
  barcode: string;
  sku: string;
  price: number;
  cost: number | null;
  stock: number;
  minStock: number;
  unit: string;
  packageLabel: string;
  /** Unidades por bulto del proveedor ("" = se compra suelto). */
  packSize: string;
  /** Ya tenía un bulto cargado (para poder borrarlo). */
  hadPackSize: boolean;
  active: boolean;
  imageUrl: string | null;
  defaultSupplierId: string | null;
  /** Talle y color de una variante (0097). Sólo se mandan al editar un producto que ya es variante. */
  variantSize?: string;
  variantColor?: string;
}

export interface ActionState {
  error?: string;
}

export interface SaveProductResult extends ActionState {
  product?: {
    id: string;
    name: string;
    barcode: string | null;
    sku: string;
    cost: number | null;
    price: number;
    stock: number;
    min_stock: number;
    unit: string;
    image_url: string | null;
  };
}

export async function saveProduct(input: ProductFormInput): Promise<SaveProductResult> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  if (!input.name.trim()) {
    return { error: "El producto necesita un nombre." };
  }

  // El SKU identifica al producto: obligatorio y único en el negocio (sin importar mayúsculas).
  const sku = input.sku.trim();
  if (!sku) return { error: "El producto necesita un SKU (su código propio, único). Podés generar uno con el botón “Generar”." };
  if (sku.length > 60) return { error: "El SKU es demasiado largo (máximo 60 caracteres)." };
  {
    const { data: clash } = await supabase.from("products").select("id, name").eq("org_id", organization.id).ilike("sku", sku.replace(/[\\%_]/g, "\\$&")).limit(2);
    const other = (clash ?? []).find((p) => p.id !== input.id);
    if (other) return { error: `Ya hay un producto con el SKU “${sku}”: ${other.name}. Cada producto necesita un SKU distinto.` };
  }

  if (input.stock < 0) {
    return { error: "El stock inicial no puede ser negativo." };
  }

  if (input.minStock < 0) {
    return { error: "El stock mínimo no puede ser negativo." };
  }

  // Unidades por bulto (0052): sólo se manda con un valor o al borrar uno
  // cargado, así guardar un producto sigue andando sin la migración.
  const packRaw = input.packSize.trim().replace(",", ".");
  const packSize = packRaw === "" ? null : Number(packRaw);
  if (packSize !== null && (!Number.isFinite(packSize) || packSize <= 0 || packSize > 100000)) {
    return { error: "Las unidades por bulto tienen que ser un número mayor a cero." };
  }

  const payload = {
    org_id: organization.id,
    name: input.name.trim(),
    brand: input.brand.trim() || null,
    barcode: input.barcode.trim() || null,
    sku,
    price: input.price,
    cost: input.cost,
    min_stock: input.minStock,
    unit: input.unit,
    package_label: input.packageLabel.trim() || null,
    ...(packSize !== null || input.hadPackSize ? { pack_size: packSize } : {}),
    active: input.active,
    image_url: input.imageUrl,
    default_supplier_id: input.defaultSupplierId,
    ...(input.variantSize !== undefined || input.variantColor !== undefined
      ? { variant_size: (input.variantSize ?? "").trim().slice(0, 40) || null, variant_color: (input.variantColor ?? "").trim().slice(0, 40) || null }
      : {}),
  };

  // Límite de productos activos del plan: al crear uno activo o al
  // reactivar uno desactivado.
  if (input.active) {
    let activating = !input.id;
    if (input.id) {
      const { data: before } = await supabase.from("products").select("active").eq("id", input.id).maybeSingle();
      activating = before?.active === false;
    }
    if (activating) {
      const limitError = await checkProductLimit(supabase, organization.id);
      if (limitError) return { error: limitError };
    }
  }

  if (input.id) {
    const { error } = await supabase.from("products").update(payload).eq("id", input.id);
    if (error) return { error: error.code === "23505" ? `Ya hay un producto con el SKU “${sku}”.` : "No pudimos guardar los cambios." };

    revalidatePath("/productos");
    revalidatePath("/pos");
    return {};
  }

  // Con sucursales, el stock inicial se carga en la sucursal en la que se
  // está trabajando (un insert con stock iría a la principal).
  const { current: branch } = await getBranchContext();
  const { data, error } = await supabase
    .from("products")
    .insert({ ...payload, stock: branch ? 0 : input.stock })
    .select("id, name, barcode, sku, cost, price, stock, min_stock, unit, image_url")
    .single();

  if (error?.code === "23505") return { error: `Ya hay un producto con el SKU “${sku}”.` };
  if (error || !data) return { error: "No pudimos crear el producto." };

  if (branch && input.stock > 0) {
    const { error: stockError } = await supabase.rpc("adjust_branch_stock", {
      p_branch_id: branch.id,
      p_product_id: data.id,
      p_delta: input.stock,
      p_reason: "Stock inicial",
    });
    if (stockError) {
      return { error: "Creamos el producto, pero no pudimos cargar el stock inicial." };
    }
    data.stock = input.stock;
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  revalidatePath("/compras");

  return {
    product: {
      ...data,
      cost: data.cost === null ? null : Number(data.cost),
      price: Number(data.price),
      stock: Number(data.stock),
      min_stock: Number(data.min_stock),
    },
  };
}

export interface VariantInput {
  size: string;
  color: string;
  sku: string;
  barcode: string;
  stock: number;
  price: number;
}

export interface SaveVariantsResult extends ActionState {
  created?: number;
}

/**
 * Crea un producto con variantes (talles y colores): un grupo y una fila de producto por variante, cada una con su SKU,
 * código, stock y precio. Plan Esencial. El grupo cuenta como un solo producto para el límite del plan.
 */
export async function saveProductWithVariants(
  base: Omit<ProductFormInput, "id" | "sku" | "barcode" | "stock" | "price" | "variantSize" | "variantColor">,
  variants: VariantInput[]
): Promise<SaveVariantsResult> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "productVariants")) return { error: featureLockedMessage("productVariants") };

  const baseName = base.name.trim();
  if (!baseName) return { error: "El producto necesita un nombre." };
  if (base.minStock < 0) return { error: "El stock mínimo no puede ser negativo." };
  if (variants.length === 0) return { error: "Elegí al menos un talle o un color." };
  if (variants.length > 200) return { error: "Son demasiadas variantes juntas (máximo 200). Cargalas en dos tandas." };

  const invalid = checkVariantList(variants);
  if (invalid) return { error: invalid };
  const skuClash = await findUsedSku(supabase, organization.id, variants);
  if (skuClash) return { error: skuClash };

  if (base.active) {
    const limitError = await checkProductLimit(supabase, organization.id);
    if (limitError) return { error: limitError };
  }

  const packRaw = base.packSize.trim().replace(",", ".");
  const packSize = packRaw === "" ? null : Number(packRaw);
  if (packSize !== null && (!Number.isFinite(packSize) || packSize <= 0 || packSize > 100000)) {
    return { error: "Las unidades por bulto tienen que ser un número mayor a cero." };
  }

  const { data: group, error: groupError } = await supabase
    .from("product_variant_groups")
    .insert({ org_id: organization.id, name: baseName.slice(0, 200) })
    .select("id")
    .single();
  if (groupError || !group) {
    return { error: "No pudimos crear el producto con variantes. ¿Está aplicada la migración de variantes y tu plan las incluye?" };
  }

  // Con sucursales, el stock inicial se carga en la sucursal actual (un insert con stock iría a la principal).
  const { current: branch } = await getBranchContext();
  const rows = variants.map((v) => ({
    org_id: organization.id,
    name: variantName(baseName, v.size, v.color).slice(0, 200),
    brand: base.brand.trim() || null,
    barcode: v.barcode.trim() || null,
    sku: v.sku.trim(),
    price: v.price,
    cost: base.cost,
    min_stock: base.minStock,
    unit: base.unit,
    package_label: base.packageLabel.trim() || null,
    ...(packSize !== null ? { pack_size: packSize } : {}),
    active: base.active,
    image_url: base.imageUrl,
    default_supplier_id: base.defaultSupplierId,
    variant_group_id: group.id,
    variant_size: v.size.trim() || null,
    variant_color: v.color.trim() || null,
    stock: branch ? 0 : v.stock,
  }));

  const { data: created, error } = await supabase.from("products").insert(rows).select("id, sku");
  if (error || !created) {
    // No quedan variantes a medias: se saca el grupo (las variantes no llegaron a crearse).
    await supabase.from("product_variant_groups").delete().eq("id", group.id);
    return { error: error?.code === "23505" ? "Alguno de los SKU ya está en uso. Revisalos." : error?.message?.startsWith("Tu plan incluye") ? error.message : "No pudimos crear las variantes. Probá de nuevo." };
  }

  const failed = await loadInitialStock(supabase, branch?.id ?? null, created, variants);
  if (failed > 0) {
    revalidatePath("/productos");
    return { created: created.length, error: `Creamos las variantes, pero no pudimos cargar el stock inicial de ${failed}. Cargalo con un ajuste.` };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  revalidatePath("/compras");
  return { created: created.length };
}

type Db = Awaited<ReturnType<typeof createClient>>;

/** Revisa la lista de variantes (talle o color, SKU, stock y precio válidos, sin repetidos). null = está bien. */
function checkVariantList(variants: VariantInput[]): string | null {
  const seenSkus = new Set<string>();
  const seenCombos = new Set<string>();
  for (const v of variants) {
    const size = v.size.trim();
    const color = v.color.trim();
    const sku = v.sku.trim();
    const label = [size, color].filter(Boolean).join(" · ");
    if (!size && !color) return "Cada variante necesita un talle o un color.";
    if (size.length > 40 || color.length > 40) return `“${label}”: el talle y el color pueden tener hasta 40 caracteres.`;
    if (!sku) return `Falta el SKU de la variante ${label}.`;
    if (sku.length > 60) return `El SKU de ${label} es demasiado largo (máximo 60 caracteres).`;
    if (!Number.isFinite(v.stock) || v.stock < 0) return `El stock de ${label} no es válido.`;
    if (!Number.isFinite(v.price) || v.price < 0) return `El precio de ${label} no es válido.`;
    const combo = `${size.toLowerCase()}|${color.toLowerCase()}`;
    if (seenCombos.has(combo)) return `La variante ${label} está repetida.`;
    seenCombos.add(combo);
    if (seenSkus.has(sku.toLowerCase())) return `El SKU “${sku}” está repetido entre las variantes.`;
    seenSkus.add(sku.toLowerCase());
  }
  return null;
}

/** Los SKU no pueden estar en uso por otros productos del negocio (sin importar mayúsculas). */
async function findUsedSku(supabase: Db, orgId: string, variants: VariantInput[], ignoreIds: string[] = []): Promise<string | null> {
  const existing = await fetchAll((from, to) => supabase.from("products").select("id, sku").eq("org_id", orgId).order("id").range(from, to));
  const used = new Set(existing.filter((p) => !ignoreIds.includes(p.id)).map((p) => p.sku.trim().toLowerCase()));
  const clash = variants.find((v) => used.has(v.sku.trim().toLowerCase()));
  return clash ? `Ya hay un producto con el SKU “${clash.sku.trim()}”. Cambialo para seguir.` : null;
}

/** Con sucursales, el stock inicial de cada variante se carga como un ajuste en la sucursal actual. Devuelve cuántos fallaron. */
async function loadInitialStock(supabase: Db, branchId: string | null, created: { id: string; sku: string }[], variants: VariantInput[]): Promise<number> {
  if (!branchId) return 0;
  const stockBySku = new Map(variants.map((v) => [v.sku.trim().toLowerCase(), v.stock]));
  const withStock = created.filter((c) => (stockBySku.get(c.sku.trim().toLowerCase()) ?? 0) > 0);
  let failed = 0;
  for (let i = 0; i < withStock.length; i += 10) {
    await Promise.all(
      withStock.slice(i, i + 10).map(async (c) => {
        const { error } = await supabase.rpc("adjust_branch_stock", {
          p_branch_id: branchId,
          p_product_id: c.id,
          p_delta: stockBySku.get(c.sku.trim().toLowerCase()) ?? 0,
          p_reason: "Stock inicial",
        });
        if (error) failed++;
      })
    );
  }
  return failed;
}

/**
 * Suma variantes (talles y colores) a un producto que ya existe. Si el producto todavía no tenía variantes, pasa a ser
 * una (con el talle y color que se le asignan) y arma el grupo; si ya era una variante, las nuevas se suman a su grupo.
 * Las nuevas copian marca, costo, proveedor, imagen y demás del producto de origen.
 */
export async function addVariantsToProduct(
  sourceId: string,
  own: { size: string; color: string } | null,
  variants: VariantInput[]
): Promise<SaveVariantsResult> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "productVariants")) return { error: featureLockedMessage("productVariants") };

  const { data: source } = await supabase.from("products").select("*").eq("org_id", organization.id).eq("id", sourceId).maybeSingle();
  if (!source) return { error: "No encontramos el producto." };
  if (variants.length === 0) return { error: "Elegí al menos un talle o un color." };
  if (variants.length > 200) return { error: "Son demasiadas variantes juntas (máximo 200). Cargalas en dos tandas." };

  const invalid = checkVariantList(variants);
  if (invalid) return { error: invalid };
  const skuClash = await findUsedSku(supabase, organization.id, variants);
  if (skuClash) return { error: skuClash };

  const ownSize = (own?.size ?? "").trim();
  const ownColor = (own?.color ?? "").trim();
  const wasVariant = Boolean(source.variant_group_id);
  if (!wasVariant && !ownSize && !ownColor) return { error: "Decinos qué talle o color es el producto que ya tenés cargado." };
  if (ownSize.length > 40 || ownColor.length > 40) return { error: "El talle y el color pueden tener hasta 40 caracteres." };

  // Grupo: el del producto, o uno nuevo con su nombre (así las variantes nuevas se llaman como el producto original).
  let groupId = source.variant_group_id ?? null;
  let groupName = source.name;
  let createdGroup = false;
  if (groupId) {
    const { data: g } = await supabase.from("product_variant_groups").select("name").eq("id", groupId).maybeSingle();
    if (g?.name) groupName = g.name;
  } else {
    const { data: g, error: gError } = await supabase.from("product_variant_groups").insert({ org_id: organization.id, name: source.name.slice(0, 200) }).select("id").single();
    if (gError || !g) return { error: "No pudimos crear el grupo de variantes. ¿Está aplicada la migración y tu plan las incluye?" };
    groupId = g.id;
    createdGroup = true;
  }

  // Combinaciones que el grupo ya tiene (incluida la del producto de origen, si se la asignan ahora).
  const { data: members } = await supabase.from("products").select("id, variant_size, variant_color").eq("variant_group_id", groupId);
  const taken = new Set((members ?? []).map((m) => `${(m.variant_size ?? "").toLowerCase()}|${(m.variant_color ?? "").toLowerCase()}`));
  if (!wasVariant) taken.add(`${ownSize.toLowerCase()}|${ownColor.toLowerCase()}`);
  const dup = variants.find((v) => taken.has(`${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`));
  if (dup) {
    if (createdGroup) await supabase.from("product_variant_groups").delete().eq("id", groupId as string);
    return { error: `La variante ${[dup.size.trim(), dup.color.trim()].filter(Boolean).join(" · ")} ya existe.` };
  }

  // El producto original pasa a ser una variante.
  if (!wasVariant) {
    const { error: upError } = await supabase
      .from("products")
      .update({ variant_group_id: groupId, variant_size: ownSize || null, variant_color: ownColor || null, name: variantName(source.name, ownSize, ownColor).slice(0, 200) })
      .eq("id", source.id);
    if (upError) {
      if (createdGroup) await supabase.from("product_variant_groups").delete().eq("id", groupId as string);
      return { error: "No pudimos actualizar el producto original. Probá de nuevo." };
    }
  }

  const { current: branch } = await getBranchContext();
  const rows = variants.map((v) => ({
    org_id: organization.id,
    name: variantName(groupName, v.size, v.color).slice(0, 200),
    brand: source.brand,
    barcode: v.barcode.trim() || null,
    sku: v.sku.trim(),
    price: v.price,
    cost: source.cost,
    min_stock: source.min_stock,
    unit: source.unit,
    package_label: source.package_label,
    ...(source.pack_size !== null && source.pack_size !== undefined ? { pack_size: source.pack_size } : {}),
    active: source.active,
    image_url: source.image_url,
    default_supplier_id: source.default_supplier_id,
    variant_group_id: groupId,
    variant_size: v.size.trim() || null,
    variant_color: v.color.trim() || null,
    stock: branch ? 0 : v.stock,
  }));
  const { data: created, error } = await supabase.from("products").insert(rows).select("id, sku");
  if (error || !created) {
    return { error: error?.code === "23505" ? "Alguno de los SKU ya está en uso. Revisalos." : error?.message?.startsWith("Tu plan incluye") ? error.message : "No pudimos crear las variantes. Probá de nuevo." };
  }

  const failed = await loadInitialStock(supabase, branch?.id ?? null, created, variants);
  revalidatePath("/productos");
  revalidatePath("/pos");
  revalidatePath("/compras");
  if (failed > 0) return { created: created.length, error: `Creamos las variantes, pero no pudimos cargar el stock inicial de ${failed}. Cargalo con un ajuste.` };
  return { created: created.length };
}

/**
 * Cambia sólo el costo o el stock mínimo de un producto (edición rápida desde la tabla de Stock).
 * No revalida páginas: la tabla aplica el valor nuevo (un revalidatePath re-renderizaría la pantalla).
 */
export async function updateProductQuick(
  id: string,
  field: "cost" | "min_stock",
  value: number
): Promise<ActionState> {
  const { organization } = await requireOrgContext();
  if (field !== "cost" && field !== "min_stock") return { error: "Campo inválido." };
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
    return { error: field === "cost" ? "El costo tiene que ser un número de cero o más." : "El mínimo tiene que ser un número de cero o más." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update(field === "cost" ? { cost: value } : { min_stock: value })
    .eq("id", id)
    .eq("org_id", organization.id);
  if (error) return { error: "No pudimos guardar el cambio." };
  return {};
}

/** Cambia el precio de venta de todas las variantes de un producto de una vez. */
export async function setVariantGroupPrice(groupId: string, price: number): Promise<ActionState> {
  const { organization } = await requireOrgContext();
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000_000) {
    return { error: "El precio tiene que ser un número de cero o más." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ price })
    .eq("variant_group_id", groupId)
    .eq("org_id", organization.id);
  if (error) return { error: "No pudimos cambiar el precio." };
  return {};
}

export interface VariantGroupShared {
  /** Nombre del producto sin el talle y color (cada variante lo lleva al final). */
  name: string;
  brand: string;
  /** Sólo si se cambió: pisa el costo de todas las variantes. */
  cost?: number | null;
  minStock: number;
  unit: string;
  packageLabel: string;
  packSize: string;
  hadPackSize: boolean;
  imageUrl: string | null;
  defaultSupplierId: string | null;
}

export interface VariantRowEdit {
  id: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  price: number;
}

/**
 * Guarda el producto con variantes de una vez: los datos compartidos (nombre, marca, proveedor, mínimo, etc.) van a todas
 * las variantes, y cada una conserva su propio SKU, código de barras y precio. El stock no se toca acá (se ajusta aparte).
 */
export async function saveVariantGroup(groupId: string, shared: VariantGroupShared, rows: VariantRowEdit[]): Promise<ActionState> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const baseName = shared.name.trim();
  if (!baseName) return { error: "El producto necesita un nombre." };
  if (shared.minStock < 0) return { error: "El stock mínimo no puede ser negativo." };
  if (shared.cost !== undefined && shared.cost !== null && (!Number.isFinite(shared.cost) || shared.cost < 0)) {
    return { error: "El costo tiene que ser un número de cero o más." };
  }
  const packRaw = shared.packSize.trim().replace(",", ".");
  const packSize = packRaw === "" ? null : Number(packRaw);
  if (packSize !== null && (!Number.isFinite(packSize) || packSize <= 0 || packSize > 100000)) {
    return { error: "Las unidades por bulto tienen que ser un número mayor a cero." };
  }

  const { data: members } = await supabase
    .from("products")
    .select("id, variant_size, variant_color")
    .eq("org_id", organization.id)
    .eq("variant_group_id", groupId);
  if (!members || members.length === 0) return { error: "No encontramos las variantes de este producto." };
  const memberById = new Map(members.map((m) => [m.id, m]));

  const seen = new Set<string>();
  const combos = new Set<string>();
  for (const r of rows) {
    if (!memberById.has(r.id)) return { error: "Una de las variantes ya no existe. Recargá la página." };
    const size = r.size.trim();
    const color = r.color.trim();
    if (!size && !color) return { error: "Cada variante necesita un talle o un color." };
    if (size.length > 40 || color.length > 40) return { error: "El talle y el color pueden tener hasta 40 caracteres." };
    const combo = `${size.toLowerCase()}|${color.toLowerCase()}`;
    if (combos.has(combo)) return { error: `Hay dos variantes con el mismo talle y color (${[size, color].filter(Boolean).join(" · ")}).` };
    combos.add(combo);
    const sku = r.sku.trim();
    if (!sku) return { error: "Cada variante necesita un SKU." };
    if (sku.length > 60) return { error: "El SKU es demasiado largo (máximo 60 caracteres)." };
    if (seen.has(sku.toLowerCase())) return { error: `El SKU “${sku}” está repetido en dos variantes.` };
    seen.add(sku.toLowerCase());
    if (!Number.isFinite(r.price) || r.price < 0 || r.price > 1_000_000_000) return { error: "El precio tiene que ser un número de cero o más." };
  }
  const clash = await findUsedSku(
    supabase,
    organization.id,
    rows.map((r) => ({ size: "", color: "", sku: r.sku, barcode: "", stock: 0, price: 0 })),
    members.map((m) => m.id)
  );
  if (clash) return { error: clash };

  const common = {
    brand: shared.brand.trim() || null,
    min_stock: shared.minStock,
    unit: shared.unit,
    package_label: shared.packageLabel.trim() || null,
    ...(packSize !== null || shared.hadPackSize ? { pack_size: packSize } : {}),
    image_url: shared.imageUrl,
    default_supplier_id: shared.defaultSupplierId,
    ...(shared.cost !== undefined ? { cost: shared.cost } : {}),
  };

  const rowById = new Map(rows.map((r) => [r.id, r]));
  let failed = 0;
  for (let i = 0; i < members.length; i += 10) {
    await Promise.all(
      members.slice(i, i + 10).map(async (m) => {
        const r = rowById.get(m.id);
        const size = (r ? r.size : m.variant_size ?? "").trim();
        const color = (r ? r.color : m.variant_color ?? "").trim();
        const { error } = await supabase
          .from("products")
          .update({
            ...common,
            name: variantName(baseName, size, color).slice(0, 200),
            variant_size: size || null,
            variant_color: color || null,
            ...(r ? { sku: r.sku.trim(), barcode: r.barcode.trim() || null, price: r.price } : {}),
          })
          .eq("id", m.id)
          .eq("org_id", organization.id);
        if (error) failed++;
      })
    );
  }
  await supabase.from("product_variant_groups").update({ name: baseName.slice(0, 200) }).eq("id", groupId).eq("org_id", organization.id);

  revalidatePath("/productos");
  revalidatePath("/pos");
  if (failed > 0) return { error: `No pudimos guardar ${failed} de ${members.length} variantes. Revisá los SKU y probá de nuevo.` };
  return {};
}

export async function createBrandQuick(name: string): Promise<{ error?: string; id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Ingresá un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .insert({ org_id: organization.id, name: trimmed })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No pudimos crear la marca." };
  }

  revalidatePath("/productos");

  return { id: data.id };
}

export async function createSupplierQuick(name: string): Promise<{ error?: string; id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Ingresá un nombre." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ org_id: organization.id, name: trimmed })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No pudimos crear el proveedor." };
  }

  revalidatePath("/productos");
  revalidatePath("/compras");
  revalidatePath("/proveedores");

  return { id: data.id };
}

export async function toggleProductActive(id: string, active: boolean): Promise<ActionState> {
  const supabase = await createClient();
  if (active) {
    const { organization } = await requireOrgContext();
    const limitError = await checkProductLimit(supabase, organization.id);
    if (limitError) return { error: limitError };
  }
  const { error } = await supabase.from("products").update({ active }).eq("id", id);
  if (error) return { error: "No pudimos actualizar el producto." };

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}

export async function deleteProduct(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    return {
      error:
        "No pudimos borrar el producto (puede tener ventas asociadas). Podés desactivarlo en su lugar.",
    };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}

export async function adjustStock(
  productId: string,
  delta: number,
  reason: string
): Promise<ActionState> {
  if (!delta) return { error: "Ingresá una cantidad distinta de cero." };

  const { organization, userId } = await requireOrgContext();
  const supabase = await createClient();

  // Con sucursales: el ajuste es sobre el stock de la sucursal actual.
  const { current: branch } = await getBranchContext();
  if (branch) {
    const { error } = await supabase.rpc("adjust_branch_stock", {
      p_branch_id: branch.id,
      p_product_id: productId,
      p_delta: delta,
      p_reason: reason || null,
    });
    if (error) {
      return {
        error: /negativo/.test(error.message)
          ? "El ajuste dejaría el stock en negativo."
          : "No pudimos actualizar el stock.",
      };
    }
    revalidatePath("/productos");
    revalidatePath("/pos");
    return {};
  }

  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, stock")
    .eq("id", productId)
    .eq("org_id", organization.id)
    .single();

  if (fetchError || !product) {
    return { error: "No encontramos el producto." };
  }

  const newStock = Number(product.stock) + delta;
  if (newStock < 0) {
    return { error: "El ajuste dejaría el stock en negativo." };
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", productId);

  if (updateError) {
    return { error: "No pudimos actualizar el stock." };
  }

  await supabase.from("stock_movements").insert({
    org_id: organization.id,
    product_id: productId,
    type: "ajuste",
    quantity: delta,
    reference: reason || null,
    user_id: userId,
  });

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}

export async function saveBrand(id: string | undefined, name: string): Promise<ActionState> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "La marca necesita un nombre." };

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  if (id) {
    const { data: existing } = await supabase
      .from("brands")
      .select("name")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("brands")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) return { error: "No pudimos guardar los cambios." };

    // products.brand guarda el nombre (no un id): renombrar la marca acá
    // debe reflejarse en los productos que ya la tenían asignada.
    if (existing && existing.name !== trimmed) {
      await supabase
        .from("products")
        .update({ brand: trimmed })
        .eq("org_id", organization.id)
        .eq("brand", existing.name);
    }
  } else {
    const { error } = await supabase
      .from("brands")
      .insert({ org_id: organization.id, name: trimmed });
    if (error) return { error: "No pudimos crear la marca." };
  }

  revalidatePath("/productos");
  return {};
}

export async function deleteBrand(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) return { error: "No pudimos borrar la marca." };

  revalidatePath("/productos");
  return {};
}

export interface BulkPriceIncreaseResult extends ActionState {
  updatedCount?: number;
  // Sólo con alsoPrice: cuántos precios de venta subieron junto al costo.
  priceUpdatedCount?: number;
}

// Agrupa por proveedor por defecto o por marca (uno de los dos) — usado
// tanto para "Aumentar precios" como para "Aumentar costos".
export async function bulkIncreaseField(
  field: "price" | "cost",
  groupBy: { supplierId: string } | { brand: string },
  mode: "percent" | "fixed",
  // Con signo: positivo aumenta, negativo baja.
  value: number,
  // Sólo para costos: cambia también el precio de venta en la misma
  // proporción que el costo de cada producto (migración 0040).
  alsoPrice = false
): Promise<BulkPriceIncreaseResult> {
  // Positivo aumenta, negativo baja.
  if (!value || !Number.isFinite(value)) return { error: "Ingresá un valor mayor a cero." };
  if (mode === "percent" && value <= -100) {
    return { error: "Para bajar, el porcentaje tiene que ser menor a 100." };
  }
  if (mode === "fixed" && value < 0 && field === "cost" && alsoPrice) {
    return { error: "Con monto fijo no se puede bajar el precio junto con el costo. Usá porcentaje." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  if (!canUse(await getSubscription(supabase, organization.id), "bulkPriceChanges")) {
    return { error: featureLockedMessage("bulkPriceChanges") };
  }
  const rateError = await checkRateLimit(supabase, organization.id, "precios_masivos", 300, 3600);
  if (rateError) return { error: rateError };

  if (field === "cost" && alsoPrice) {
    const { data, error } = await supabase.rpc("bulk_increase_cost_with_price", {
      p_org_id: organization.id,
      p_supplier_id: "supplierId" in groupBy ? groupBy.supplierId : null,
      p_brand: "brand" in groupBy ? groupBy.brand : null,
      p_percent: mode === "percent" ? value : null,
      p_fixed_amount: mode === "fixed" ? value : null,
    });
    if (error || !data) return { error: "No pudimos actualizar los costos y precios." };
    revalidatePath("/productos");
    revalidatePath("/pos");
    return { updatedCount: data.cost_count, priceUpdatedCount: data.price_count };
  }

  const { data, error } = await supabase.rpc("bulk_increase_field", {
    p_org_id: organization.id,
    p_field: field,
    p_supplier_id: "supplierId" in groupBy ? groupBy.supplierId : null,
    p_brand: "brand" in groupBy ? groupBy.brand : null,
    p_percent: mode === "percent" ? value : null,
    p_fixed_amount: mode === "fixed" ? value : null,
  });

  if (error) {
    return {
      error: field === "price" ? "No pudimos actualizar los precios." : "No pudimos actualizar los costos.",
    };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  return { updatedCount: data ?? 0 };
}

// Se pueden deshacer los aumentos masivos de los últimos 30 días (el mismo
// límite valida revert_bulk_price_change, migración 0039).
const BULK_UNDO_DAYS = 30;

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface BulkChangeInfo {
  groupLabel: string;
  amountLabel: string;
}

// "+13%" / "+$500" y "Distribuidora Norte" / "Marca Arcor" de cada aumento.
async function describeBulkChanges(
  supabase: Supabase,
  changes: {
    id: string;
    supplier_id: string | null;
    brand: string | null;
    percent: number | null;
    fixed_amount: number | null;
  }[]
): Promise<Map<string, BulkChangeInfo>> {
  const supplierIds = Array.from(
    new Set(changes.map((c) => c.supplier_id).filter((id): id is string => Boolean(id)))
  );
  const { data: suppliers } =
    supplierIds.length > 0
      ? await supabase.from("suppliers").select("id, name").in("id", supplierIds)
      : { data: [] as { id: string; name: string }[] };
  const supplierName = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  return new Map(
    changes.map((c) => [
      c.id,
      {
        groupLabel: c.brand
          ? `Marca ${c.brand}`
          : (c.supplier_id && supplierName.get(c.supplier_id)) || "Proveedor borrado",
        amountLabel:
          c.percent !== null
            ? `${Number(c.percent) < 0 ? "-" : "+"}${Math.abs(Number(c.percent)).toLocaleString("es-AR")}%`
            : c.fixed_amount !== null
              ? `${Number(c.fixed_amount) < 0 ? "-" : "+"}${formatCurrency(Math.abs(Number(c.fixed_amount)))}`
              : // Precio cambiado junto a un ajuste de costo en monto fijo (0040).
                "Proporcional al costo",
      },
    ])
  );
}

async function memberLabels(
  supabase: Supabase,
  orgId: string,
  userIds: (string | null)[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return new Map();
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, username, email")
    .eq("org_id", orgId)
    .in("user_id", ids);
  return new Map(
    (members ?? []).map((m) => [m.user_id, m.username ?? m.email ?? "Alguien del equipo"])
  );
}

/** El aumento de la otra columna que se hizo junto con éste (costo con precio, migración 0040). */
export interface LinkedBulkChange {
  id: string;
  /** "price": un aumento de costo que subió también el precio. "cost": un aumento de precio que vino de subir el costo. */
  kind: "price" | "cost";
  productCount: number;
  reverted: boolean;
}

export interface BulkChangeRow extends BulkChangeInfo {
  id: string;
  productCount: number;
  createdAt: string;
  createdByLabel: string | null;
  reverted: boolean;
  linked: LinkedBulkChange | null;
}

export async function getRecentBulkChanges(field: "price" | "cost"): Promise<BulkChangeRow[]> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const since = new Date(Date.now() - BULK_UNDO_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("bulk_price_changes")
    .select("id, supplier_id, brand, percent, fixed_amount, product_count, created_by, created_at, reverted_at")
    .eq("org_id", organization.id)
    .eq("field", field)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!rows || rows.length === 0) return [];

  // "Aumentar costos" con la casilla del precio deja dos registros (costo y
  // precio) creados en la misma transacción, o sea con la misma fecha y hora
  // y el mismo proveedor o marca. Así se sabe cuál acompaña a cuál.
  const otherField = field === "cost" ? "price" : "cost";
  const { data: others } = await supabase
    .from("bulk_price_changes")
    .select("id, supplier_id, brand, product_count, created_at, reverted_at")
    .eq("org_id", organization.id)
    .eq("field", otherField)
    .in("created_at", rows.map((r) => r.created_at));

  const [info, members] = await Promise.all([
    describeBulkChanges(supabase, rows),
    memberLabels(supabase, organization.id, rows.map((r) => r.created_by)),
  ]);

  return rows.map((r) => {
    const match = (others ?? []).find(
      (o) => o.created_at === r.created_at && o.supplier_id === r.supplier_id && o.brand === r.brand
    );
    return {
      id: r.id,
      ...info.get(r.id)!,
      productCount: r.product_count,
      createdAt: r.created_at,
      createdByLabel: r.created_by ? members.get(r.created_by) ?? null : null,
      reverted: r.reverted_at !== null,
      linked: match
        ? {
            id: match.id,
            kind: otherField,
            productCount: match.product_count,
            reverted: match.reverted_at !== null,
          }
        : null,
    };
  });
}

export interface RevertBulkChangeResult extends ActionState {
  reverted?: number;
  skipped?: number;
  /** Si se pidió deshacer también el aumento que lo acompañaba: cómo salió. */
  linked?: { reverted: number; skipped: number; error?: string };
}

function revertErrorMessage(message: string | undefined): string {
  if (message?.includes("ya se deshizo")) return "Ese aumento ya se deshizo.";
  if (message?.includes("30 días")) return "Sólo se pueden deshacer aumentos de los últimos 30 días.";
  return "No pudimos deshacer el aumento.";
}

/**
 * Deshace un aumento masivo. Con `alsoLinkedId` deshace además el que se hizo
 * junto con éste (el aumento de precio de un aumento de costo): son dos
 * deshacer independientes, así que si el segundo falla el primero queda hecho
 * y se avisa.
 */
export async function revertBulkChange(
  bulkChangeId: string,
  alsoLinkedId?: string
): Promise<RevertBulkChangeResult> {
  await requireOrgContext();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("revert_bulk_price_change", {
    p_bulk_change_id: bulkChangeId,
  });

  if (error || !data) return { error: revertErrorMessage(error?.message) };

  const result: RevertBulkChangeResult = { reverted: data.reverted, skipped: data.skipped };

  if (alsoLinkedId) {
    const { data: linkedData, error: linkedError } = await supabase.rpc("revert_bulk_price_change", {
      p_bulk_change_id: alsoLinkedId,
    });
    result.linked =
      linkedError || !linkedData
        ? { reverted: 0, skipped: 0, error: revertErrorMessage(linkedError?.message) }
        : { reverted: linkedData.reverted, skipped: linkedData.skipped };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  return result;
}

export interface ProductHistoryRow {
  id: string;
  oldValue: number;
  newValue: number;
  changedAt: string;
  changedByLabel: string | null;
  // Si el cambio vino de un aumento masivo (migración 0039).
  bulk: BulkChangeInfo | null;
}

interface HistoryDbRow {
  id: string;
  oldValue: number;
  newValue: number;
  changed_by: string | null;
  created_at: string;
  bulk_change_id: string | null;
}

async function fetchHistoryRows(
  supabase: Supabase,
  orgId: string,
  productId: string,
  field: "price" | "cost"
): Promise<HistoryDbRow[]> {
  // Pide bulk_change_id; si la columna todavía no existe (código publicado
  // antes de aplicar 0039) vuelve a pedir sin ella para no dejar el
  // historial vacío.
  const run = async (withBulk: boolean) => {
    if (field === "price") {
      const { data, error } = await supabase
        .from("product_price_history")
        .select(
          withBulk
            ? "id, old_price, new_price, changed_by, created_at, bulk_change_id"
            : "id, old_price, new_price, changed_by, created_at"
        )
        .eq("org_id", orgId)
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as unknown as {
        id: string;
        old_price: number;
        new_price: number;
        changed_by: string | null;
        created_at: string;
        bulk_change_id?: string | null;
      }[];
      return {
        error,
        rows: rows.map((r) => ({
          id: r.id,
          oldValue: Number(r.old_price),
          newValue: Number(r.new_price),
          changed_by: r.changed_by,
          created_at: r.created_at,
          bulk_change_id: r.bulk_change_id ?? null,
        })),
      };
    }
    const { data, error } = await supabase
      .from("product_cost_history")
      .select(
        withBulk
          ? "id, old_cost, new_cost, changed_by, created_at, bulk_change_id"
          : "id, old_cost, new_cost, changed_by, created_at"
      )
      .eq("org_id", orgId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as {
      id: string;
      old_cost: number;
      new_cost: number;
      changed_by: string | null;
      created_at: string;
      bulk_change_id?: string | null;
    }[];
    return {
      error,
      rows: rows.map((r) => ({
        id: r.id,
        oldValue: Number(r.old_cost),
        newValue: Number(r.new_cost),
        changed_by: r.changed_by,
        created_at: r.created_at,
        bulk_change_id: r.bulk_change_id ?? null,
      })),
    };
  };

  const first = await run(true);
  if (!first.error) return first.rows;
  return (await run(false)).rows;
}

export async function getProductHistory(
  productId: string,
  field: "price" | "cost"
): Promise<ProductHistoryRow[]> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const rows = await fetchHistoryRows(supabase, organization.id, productId, field);
  if (rows.length === 0) return [];

  const bulkIds = Array.from(
    new Set(rows.map((r) => r.bulk_change_id).filter((id): id is string => Boolean(id)))
  );
  const [members, bulkInfo] = await Promise.all([
    memberLabels(supabase, organization.id, rows.map((r) => r.changed_by)),
    bulkIds.length > 0
      ? supabase
          .from("bulk_price_changes")
          .select("id, supplier_id, brand, percent, fixed_amount")
          .in("id", bulkIds)
          .then(({ data }) => describeBulkChanges(supabase, data ?? []))
      : Promise.resolve(new Map<string, BulkChangeInfo>()),
  ]);

  return rows.map((r) => ({
    id: r.id,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedAt: r.created_at,
    changedByLabel: r.changed_by ? members.get(r.changed_by) ?? null : null,
    bulk: r.bulk_change_id ? bulkInfo.get(r.bulk_change_id) ?? null : null,
  }));
}

export async function revertProductField(
  productId: string,
  field: "price" | "cost",
  value: number
): Promise<ActionState> {
  if (!Number.isFinite(value) || value < 0) {
    return { error: field === "price" ? "Precio inválido." : "Costo inválido." };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  if (!canUse(await getSubscription(supabase, organization.id), "priceRevert")) {
    return { error: featureLockedMessage("priceRevert") };
  }

  const { error } = await supabase
    .from("products")
    .update(field === "price" ? { price: value } : { cost: value })
    .eq("id", productId)
    .eq("org_id", organization.id);

  if (error) {
    return { error: field === "price" ? "No pudimos volver a ese precio." : "No pudimos volver a ese costo." };
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  return {};
}

/** Próximo SKU libre con el formato "P-00001" (para el botón "Generar" del formulario de producto). */
export async function suggestSku(): Promise<string> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const rows = await fetchAll((from, to) =>
    supabase.from("products").select("id, sku").eq("org_id", organization.id).ilike("sku", "P-%").order("id").range(from, to)
  );
  let max = 0;
  for (const r of rows) {
    const m = /^P-(\d{1,9})$/i.exec(r.sku.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `P-${String(max + 1).padStart(5, "0")}`;
}
