import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  LayoutGrid,
  LifeBuoy,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  Users,
  UserCog,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Operación",
    items: [
      { href: "/pos", label: "Punto de Venta", icon: ShoppingCart },
      { href: "/compras", label: "Compras", icon: ShoppingBag, badge: "Pronto" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/productos", label: "Productos", icon: LayoutGrid },
      { href: "/inventario", label: "Inventario", icon: Boxes },
    ],
  },
  {
    title: "Personas",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/usuarios", label: "Usuarios", icon: UserCog, badge: "Pronto" },
    ],
  },
  {
    title: "Análisis",
    items: [{ href: "/reportes", label: "Reportes", icon: BarChart3 }],
  },
  {
    title: "IA",
    items: [
      { href: "/recomendaciones", label: "Recomendaciones", icon: Sparkles, badge: "Pronto" },
      { href: "/baja-rotacion", label: "Baja rotación", icon: TrendingDown, badge: "Pronto" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/configuracion", label: "Configuración", icon: Settings },
      { href: "/soporte", label: "Soporte", icon: LifeBuoy },
    ],
  },
];

export const pageTitles: Record<string, { title: string; description: string }> = {
  "/pos": { title: "Punto de Venta", description: "Cobrá tus ventas y armá el carrito." },
  "/compras": { title: "Compras", description: "Registrá el ingreso de mercadería." },
  "/productos": { title: "Productos", description: "Tu catálogo completo." },
  "/inventario": { title: "Inventario", description: "Stock y movimientos de productos." },
  "/clientes": { title: "Clientes", description: "Tus clientes y sus cuentas." },
  "/usuarios": { title: "Usuarios", description: "Accesos de tu equipo." },
  "/reportes": { title: "Reportes", description: "El estado de tu negocio de un vistazo." },
  "/recomendaciones": { title: "Recomendaciones", description: "Sugerencias inteligentes para tu kiosco." },
  "/baja-rotacion": { title: "Baja rotación", description: "Productos que no se están moviendo." },
  "/configuracion": { title: "Configuración", description: "Datos de tu kiosco." },
  "/soporte": { title: "Soporte", description: "¿Necesitás ayuda?" },
  "/caja": { title: "Mi Caja", description: "Apertura y cierre de caja." },
};
