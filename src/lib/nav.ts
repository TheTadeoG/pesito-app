import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CreditCard,
  LayoutGrid,
  LifeBuoy,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  TrendingDown,
  Users,
  UserCog,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  // Sólo visible para dueños/administradores (ej. gestión de usuarios).
  adminOnly?: boolean;
  // Cuándo se lo marca activo en el sidebar, según el ?tab= de la URL —
  // undefined significa "no le importa el tab, cualquiera lo activa"
  // (comportamiento de siempre). Se usa para diferenciar dos items de nav
  // que apuntan al mismo path (ej. Configuración vs. Planes, las dos
  // pestañas de /configuracion).
  activeTab?: string | null;
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
      { href: "/caja", label: "Caja", icon: Wallet },
      { href: "/compras", label: "Compras", icon: ShoppingBag },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/productos", label: "Productos", icon: LayoutGrid },
    ],
  },
  {
    title: "Personas",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/proveedores", label: "Proveedores", icon: Truck },
      { href: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
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
      { href: "/configuracion", label: "Configuración", icon: Settings, activeTab: null },
      { href: "/configuracion?tab=plan", label: "Planes", icon: CreditCard, activeTab: "plan" },
      { href: "/soporte", label: "Soporte", icon: LifeBuoy },
    ],
  },
];

// Compartido entre Sidebar y MobileNav: si el item no declara activeTab, el
// path solo ya lo activa (comportamiento de siempre — ej. Productos sigue
// activo en cualquiera de sus ?tab=). Si lo declara, además tiene que
// coincidir el ?tab= actual — así Configuración y Planes, que comparten
// path, no quedan los dos "activos" a la vez.
export function isNavItemActive(item: NavItem, pathname: string, tabParam: string | null): boolean {
  const [itemPath] = item.href.split("?");
  const pathMatches = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  if (!pathMatches) return false;
  if (item.activeTab === undefined) return true;
  return item.activeTab === tabParam;
}

export const pageTitles: Record<string, { title: string; description: string }> = {
  "/pos": { title: "Punto de Venta", description: "Cobrá tus ventas y armá el carrito." },
  "/compras": { title: "Compras", description: "Registrá el ingreso de mercadería." },
  "/productos": { title: "Productos", description: "Tu catálogo, el stock y las marcas." },
  "/clientes": { title: "Clientes", description: "Tus clientes y sus cuentas." },
  "/proveedores": { title: "Proveedores", description: "Tus proveedores y sus cuentas." },
  "/usuarios": { title: "Usuarios", description: "Invitá a tu equipo y elegí qué puede hacer cada uno." },
  "/reportes": { title: "Reportes", description: "El estado de tu negocio de un vistazo." },
  "/recomendaciones": { title: "Recomendaciones", description: "Sugerencias inteligentes para tu negocio." },
  "/baja-rotacion": { title: "Baja rotación", description: "Productos que no se están moviendo." },
  "/configuracion": { title: "Configuración", description: "Datos de tu negocio." },
  "/soporte": { title: "Soporte", description: "¿Necesitás ayuda?" },
  "/caja": { title: "Mi Caja", description: "Apertura y cierre de caja." },
};
