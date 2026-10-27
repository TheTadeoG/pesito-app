// La guía paso a paso ("Primeros pasos" guiados): qué mostrarle a un negocio nuevo, en orden, para que
// haga su primera venta y conozca lo demás. Sólo datos: el motor que los muestra está en
// components/dashboard/tour-controller.tsx. Cada paso señala un elemento de la pantalla con
// data-tour="..." (o un id) y avanza solo cuando la persona hace lo que se le pide.

export type TourAdvance =
  /** Tocar el elemento señalado (un botón del menú, "Nuevo producto"…). */
  | { type: "click" }
  /** El elemento desaparece (se guardó o se cerró el formulario). */
  | { type: "gone" }
  /** El botón "Siguiente" del cartel (con `requires`: queda apagado hasta que ese campo tenga algo). */
  | { type: "next"; label?: string; requires?: string }
  /** Otro elemento deja de estar deshabilitado (el carrito ya tiene algo y se puede cobrar). */
  | { type: "enabled"; selector: string }
  /** Aparece otro elemento (se abrió el aviso de venta cobrada). */
  | { type: "appear"; selector: string };

export interface TourStep {
  id: string;
  /** Pantalla donde pasa ("*" = en cualquiera, por ejemplo un botón del menú). */
  path: string;
  /** Selector CSS del elemento a señalar; sin esto, el cartel va en el centro. */
  target?: string;
  title: string;
  text: string;
  side?: "top" | "bottom" | "left" | "right";
  advance: TourAdvance;
  /** A dónde lleva el botón del cartel cuando el elemento no se ve (menú del celular, otra pantalla). */
  goTo?: string;
  /** Si el elemento no aparece: "skip" salta hasta `skipTo`; "show" muestra el cartel en el centro. */
  ifMissing?: "skip" | "show";
  skipTo?: string;
  /** Texto del cartel cuando el elemento no está (por ejemplo, la caja cerrada en el POS). */
  missingText?: string;
  /** Cuánto esperar (ms) a que aparezca el elemento antes de dar el paso por perdido. */
  waitMs?: number;
  /** Paso sin cartel: sólo espera a que pase algo (para no tapar el cobro con la pantalla oscura). */
  quiet?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  // --- 1. Un producto
  {
    id: "nav-productos",
    path: "*",
    target: '[data-tour="nav-/productos"]',
    title: "Empecemos por tus productos",
    text: "Acá vive tu catálogo. Tocá «Productos» para entrar.",
    side: "right",
    advance: { type: "click" },
    goTo: "/productos",
  },
  {
    id: "new-product",
    path: "/productos",
    target: '[data-tour="new-product"]',
    title: "Cargá tu primer producto",
    text: "Tocá «Nuevo producto». Si ya tenés una lista en Excel, también podés subirla de una vez desde «Acciones».",
    side: "bottom",
    advance: { type: "click" },
  },
  {
    id: "product-name",
    path: "/productos",
    target: "#p-name",
    title: "El nombre",
    text: "Escribilo como lo ves en la góndola. Por ejemplo: «Coca-Cola 1,5 L».",
    side: "bottom",
    advance: { type: "next", requires: "#p-name" },
  },
  {
    id: "product-price",
    path: "/productos",
    target: '[data-tour="p-price"]',
    title: "El precio de venta",
    text: "Poné cuánto cobrás. El costo y el stock los podés cargar después; con el costo, Pesito te calcula cuánto ganás.",
    side: "bottom",
    advance: { type: "next", requires: "#p-price" },
  },
  {
    id: "product-save",
    path: "/productos",
    target: '[data-tour="product-save"]',
    title: "Guardalo",
    text: "Tocá «Crear producto».",
    side: "top",
    advance: { type: "gone" },
  },
  // --- 2. La caja
  {
    id: "nav-caja",
    path: "*",
    target: '[data-tour="nav-/caja"]',
    title: "Ahora, la caja",
    text: "Antes de vender, abrís la caja con el efectivo con el que empezás. Tocá «Caja».",
    side: "right",
    advance: { type: "click" },
    goTo: "/caja",
  },
  {
    id: "open-caja",
    path: "/caja",
    target: '[data-tour="open-caja"]',
    title: "Abrí tu caja",
    text: "Tocá «Abrir Mi Caja».",
    side: "bottom",
    advance: { type: "click" },
    ifMissing: "skip",
    skipTo: "nav-pos",
    waitMs: 1500,
  },
  {
    id: "caja-amount",
    path: "/caja",
    target: '[data-tour="caja-amount"]',
    title: "Con cuánto efectivo empezás",
    text: "Escribí cuánto efectivo hay en la caja ahora (si empezás sin plata, poné 0). Así, al cerrar, sabés si el dinero cierra.",
    side: "bottom",
    advance: { type: "next" },
    ifMissing: "skip",
    skipTo: "nav-pos",
    waitMs: 1500,
  },
  {
    id: "caja-submit",
    path: "/caja",
    target: '[data-tour="caja-submit"]',
    title: "Confirmá",
    text: "Tocá «Abrir Caja».",
    side: "top",
    advance: { type: "gone" },
    ifMissing: "skip",
    skipTo: "nav-pos",
    waitMs: 1500,
  },
  // --- 3. La primera venta
  {
    id: "nav-pos",
    path: "*",
    target: '[data-tour="nav-/pos"]',
    title: "A vender",
    text: "Tocá «Vender» para abrir el punto de venta.",
    side: "right",
    advance: { type: "click" },
    goTo: "/pos",
  },
  {
    id: "pos-search",
    path: "/pos",
    target: '[data-tour="pos-search"]',
    title: "Buscá el producto",
    text: "Escribí el nombre o escaneá el código de barras, y tocá el producto para sumarlo al carrito.",
    side: "bottom",
    advance: { type: "enabled", selector: '[data-tour="pos-charge"]' },
    ifMissing: "show",
    missingText: "Para vender necesitás la caja abierta. Abrila desde «Caja» y volvé a tocar «Vender».",
    goTo: "/caja",
  },
  {
    id: "pos-charge",
    path: "/pos",
    target: '[data-tour="pos-charge"]',
    title: "Cobrá",
    text: "Tocá «Cobrar», elegí cómo paga (efectivo, tarjeta, transferencia…) y confirmá. Te muestra el vuelto y podés imprimir el ticket.",
    side: "left",
    advance: { type: "click" },
  },
  {
    id: "wait-sale",
    path: "/pos",
    quiet: true,
    title: "",
    text: "",
    advance: { type: "appear", selector: '[data-tour="sale-done"]' },
  },
  {
    id: "sale-done",
    path: "/pos",
    target: '[data-tour="sale-done"]',
    title: "¡Venta cobrada!",
    text: "Así de simple: el stock se descontó solo y la plata quedó en la caja. Cuando termines, tocá «Nueva venta» para seguir.",
    side: "left",
    advance: { type: "gone" },
  },
  // --- 4. Lo que sigue
  {
    id: "nav-compras",
    path: "*",
    target: '[data-tour="nav-/compras"]',
    title: "Cuando te llega mercadería",
    text: "Cargá una compra para sumar stock y guardar el costo. Tocá «Compras».",
    side: "right",
    advance: { type: "click" },
    goTo: "/compras",
  },
  {
    id: "compras-form",
    path: "/compras",
    target: '[data-tour="compras-form"]',
    title: "Registrá la compra",
    text: "Elegí el proveedor y los productos con su cantidad y costo. Al guardar, el stock se suma solo.",
    side: "top",
    advance: { type: "next" },
  },
  {
    id: "nav-clientes",
    path: "*",
    target: '[data-tour="nav-/clientes"]',
    title: "Para anotar el fiado",
    text: "Si le fiás a algún cliente, cargalo para ver cuánto te debe. Tocá «Clientes».",
    side: "right",
    advance: { type: "click" },
    goTo: "/clientes",
  },
  {
    id: "new-customer",
    path: "/clientes",
    target: '[data-tour="new-customer"]',
    title: "Cargá un cliente",
    text: "Con «Nuevo cliente» lo agregás. Después, al cobrar en el punto de venta, elegís «Fiado» y queda anotado lo que te debe.",
    side: "bottom",
    advance: { type: "next" },
  },
  {
    id: "nav-reportes",
    path: "*",
    target: '[data-tour="nav-/reportes"]',
    title: "Cómo viene el negocio",
    text: "Mirá cuánto vendiste y cuánto ganás. Tocá «Reportes».",
    side: "right",
    advance: { type: "click" },
    goTo: "/reportes",
  },
  {
    id: "finish",
    path: "/reportes",
    title: "¡Listo! Ya conocés lo principal",
    text: "Al terminar el día, cerrá la caja desde «Caja»: contás el efectivo y Pesito te dice si sobra o falta. Podés repetir esta guía cuando quieras desde el botón de ayuda (?).",
    advance: { type: "next", label: "Terminar" },
  },
];

/** Pasos que se muestran (los "quiet" no cuentan en el "Paso X de N"). */
export function visibleSteps(steps: TourStep[] = TOUR_STEPS): TourStep[] {
  return steps.filter((s) => !s.quiet);
}

/** "Paso 3 de 18" para el paso en `index`; los pasos sin cartel no cuentan. */
export function stepNumber(index: number, steps: TourStep[] = TOUR_STEPS): { n: number; total: number } {
  const shown = visibleSteps(steps);
  const id = steps[index]?.id;
  const n = shown.findIndex((s) => s.id === id) + 1;
  return { n: n || shown.length, total: shown.length };
}
