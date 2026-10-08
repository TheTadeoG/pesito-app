// Atajos de navegación: Alt (⌥ en Mac) + número, en el orden del menú. Son
// fijos (no dependen del rol) para que cada número siempre lleve al mismo lugar.
// Con Alt el POS no los confunde con el escaneo o la búsqueda (ignora las
// teclas con modificadores).
export const NAV_SHORTCUTS: { digit: number; href: string; label: string }[] = [
  { digit: 1, href: "/pos", label: "Punto de Venta" },
  { digit: 2, href: "/caja", label: "Caja" },
  { digit: 3, href: "/productos", label: "Productos" },
  { digit: 4, href: "/compras", label: "Compras" },
  { digit: 5, href: "/clientes", label: "Clientes" },
  { digit: 6, href: "/proveedores", label: "Proveedores" },
  { digit: 7, href: "/reportes", label: "Reportes" },
];

/** Dígito (1-9) de una tecla de la fila de números, o null. Usa `code`: con Option en Mac `key` trae otro carácter. */
export function digitFromCode(code: string): number | null {
  const m = /^Digit([1-9])$/.exec(code);
  return m ? Number(m[1]) : null;
}
