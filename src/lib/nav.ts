import type { LucideIcon } from "lucide-react";
import type { PlanFeature } from "@/lib/plan-access";
import {
  BarChart3,
  CreditCard,
  Globe,
  LayoutGrid,
  LifeBuoy,
  Radio,
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
  // Función que depende del plan (lib/plan-access.ts): si el plan no la
  // incluye, el menú la muestra igual con el nombre del plan que la trae.
  feature?: PlanFeature;
  // Cuándo se lo marca activo en el sidebar, según el ?tab= de la URL —
  // undefined significa "no le importa el tab, cualquiera lo activa"
  // (comportamiento de siempre). Se usa para diferenciar dos items de nav
  // que apuntan al mismo path (ej. Configuración vs. Planes, las dos
  // pestañas de /configuracion).
  activeTab?: string | null;
}

export interface NavSection {
  title: string;
  /** Va al pie del menú, separado del resto. */
  footer?: boolean;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Mostrador",
    items: [
      { href: "/pos", label: "Punto de Venta", icon: ShoppingCart },
      { href: "/caja", label: "Caja", icon: Wallet },
    ],
  },
  {
    title: "Mercadería",
    items: [
      { href: "/productos", label: "Productos", icon: LayoutGrid },
      { href: "/compras", label: "Compras", icon: ShoppingBag },
    ],
  },
  {
    title: "Personas",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/proveedores", label: "Proveedores", icon: Truck },
      { href: "/usuarios", label: "Mi equipo", icon: UserCog, adminOnly: true },
    ],
  },
  {
    title: "Análisis",
    items: [
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/en-vivo", label: "En vivo", icon: Radio, adminOnly: true, feature: "liveView" },
    ],
  },
  {
    title: "Asistente IA",
    items: [
      { href: "/recomendaciones", label: "Qué comprar", icon: Sparkles, feature: "restockRecommendations" },
      { href: "/baja-rotacion", label: "Baja rotación", icon: TrendingDown, feature: "lowRotation" },
      { href: "/mercado", label: "Mercado", icon: Globe, feature: "marketAnalysis" },
    ],
  },
  {
    title: "Sistema",
    // Lo de uso ocasional va abajo del menú, separado.
    footer: true,
    items: [
      { href: "/configuracion", label: "Ajustes", icon: Settings },
      { href: "/planes", label: "Mi plan", icon: CreditCard },
      { href: "/soporte", label: "Ayuda", icon: LifeBuoy },
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
  "/proveedores": {
    title: "Proveedores",
    description: "Lo que les debés, cuándo vence y cuándo entrega cada uno.",
  },
  "/proveedores/calendario": {
    title: "Calendario de proveedores",
    description: "Vencimientos de tus compras a cuenta y entregas de cada proveedor.",
  },
  "/usuarios": { title: "Mi equipo", description: "Invitá a tu equipo y elegí qué puede hacer cada uno." },
  "/en-vivo": { title: "En vivo", description: "Cómo viene el día, vendedor por vendedor." },
  "/reportes": { title: "Reportes", description: "El estado de tu negocio de un vistazo." },
  "/recomendaciones": { title: "Qué comprar", description: "Qué pedir y qué precios revisar." },
  "/baja-rotacion": { title: "Baja rotación", description: "Productos que no se están moviendo." },
  "/mercado": { title: "Mercado", description: "Novedades y precios de referencia de tu rubro." },
  "/configuracion": { title: "Ajustes", description: "Datos de tu negocio." },
  "/planes": { title: "Mi plan", description: "Tu plan, los demás planes y cómo pagás." },
  "/soporte": { title: "Ayuda", description: "¿Necesitás ayuda?" },
  "/caja": { title: "Mi Caja", description: "Apertura y cierre de caja." },
};
