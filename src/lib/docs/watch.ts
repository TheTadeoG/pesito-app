// Qué código describe cada guía de /ayuda. Si alguno de estos archivos cambió después de la fecha `updatedAt` de la guía,
// `bash src/lib/docs/run-stale.sh` la marca como posiblemente desactualizada (hay que revisarla y subir su `updatedAt`).
// Se usa por categoría y, si una guía depende de otras pantallas, se agrega en `watchBySlug`.

export const watchByCategory: Record<string, string[]> = {
  empezar: ["src/app/(dashboard)/usuarios", "src/app/(dashboard)/planes", "src/lib/plan-access.ts", "src/lib/plan-features.ts"],
  vender: [
    "src/app/(dashboard)/pos",
    "src/app/(dashboard)/ventas",
    "src/components/dashboard/ventas-list.tsx",
    "src/lib/bundles.ts",
    "src/lib/variants.ts",
  ],
  caja: ["src/app/(dashboard)/caja"],
  productos: [
    "src/app/(dashboard)/productos",
    "src/app/(dashboard)/marcas",
    "src/lib/bundles.ts",
    "src/lib/variants.ts",
    "src/lib/plan-features.ts",
  ],
  stock: [
    "src/app/(dashboard)/productos/movements-tab.tsx",
    "src/app/(dashboard)/productos/transfer-dialog.tsx",
    "src/app/(dashboard)/inventario-fisico",
    "src/components/dashboard/adjust-dialog.tsx",
  ],
  compras: ["src/app/(dashboard)/compras", "src/app/(dashboard)/proveedores"],
  clientes: ["src/app/(dashboard)/clientes"],
  reportes: [
    "src/app/(dashboard)/reportes",
    "src/app/(dashboard)/actividad",
    "src/app/(dashboard)/en-vivo",
    "src/app/(dashboard)/recomendaciones",
    "src/app/(dashboard)/baja-rotacion",
    "src/app/(dashboard)/ventas",
  ],
  comprobantes: ["src/app/(dashboard)/configuracion/printer-settings.tsx", "src/app/(dashboard)/pos/sale-done-dialog.tsx"],
  cuenta: ["src/app/(dashboard)/configuracion", "src/app/(dashboard)/usuarios"],
};

/** Archivos extra de una guía puntual (se suman a los de su categoría). */
export const watchBySlug: Record<string, string[]> = {
  "como-cargar-un-producto": ["src/components/dashboard"],
  "como-agregar-un-medio-de-pago": ["src/app/(dashboard)/pos/pos-client.tsx"],
};
