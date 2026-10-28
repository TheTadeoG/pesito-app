// La guía paso a paso ("Primeros pasos" guiados): qué mostrarle a un negocio nuevo, en orden, para que
// haga su primera venta y conozca lo demás. Sólo datos: el motor que los muestra está en
// components/dashboard/tour-controller.tsx. Cada paso señala un elemento de la pantalla con
// data-tour="..." (o un id) y avanza solo cuando la persona hace lo que se le pide.

export type TourAdvance =
  /** Tocar el elemento señalado (un botón del menú, "Nuevo producto"…). */
  | { type: "click"; orAppear?: string }
  /** El elemento desaparece (se guardó o se cerró el formulario). */
  | { type: "gone" }
  /** El botón "Siguiente" del cartel (con `requires`: queda apagado hasta que ese campo tenga algo). */
  | { type: "next"; label?: string; requires?: string; positive?: boolean }
  /** Otro elemento deja de estar deshabilitado (el carrito ya tiene algo y se puede cobrar). */
  | { type: "enabled"; selector: string }
  /** Aparece otro elemento (se abrió el aviso de venta cobrada). */
  | { type: "appear"; selector: string }
  /** Aparece el elemento y después desaparece (se cobró la venta y se cerró el aviso). */
  | { type: "cycle"; selector: string };

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
  /** Cartel flotante sin pantalla oscura: la persona hace varias cosas seguidas (la venta completa). */
  floating?: boolean;
  /** Mientras no se cumpla `requires` (campos con algo; «+» = mayor a 0), el botón queda apagado. */
  gate?: { button: string; requires: string[] };
  /** Paso sin cartel: si el elemento `selector` deja de estar un rato, se vuelve al paso `backTo` (cerró el cobro sin cobrar). */
  watchGone?: { selector: string; backTo: string };
}

export const TOUR_STEPS: TourStep[] = [
  // --- 1. Un producto
  {
    id: "nav-productos",
    path: "*",
    target: '[data-tour="nav-/productos"]',
    title: "Empecemos por tus productos",
    text: "Acá está todo lo que vendés. Tocá «Productos» en el menú para entrar.",
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
    id: "product-form",
    path: "/productos",
    target: '[data-tour="product-form"]',
    title: "Cargá tu primer producto",
    text: "Completá tres cosas: el nombre, tal como lo ves en la góndola (por ejemplo, «Coca-Cola 1,5 L»); el precio de venta, en «Final (con IVA)»; y cuántas unidades tenés (aunque sea una: sin stock, Pesito no te deja venderlo). El costo y el resto son opcionales. Cuando esté todo, tocá «Crear producto».",
    side: "left",
    advance: { type: "gone" },
    gate: { button: '[data-tour="product-save"]', requires: ["#p-name", "#p-price", "+#p-stock"] },
  },
  // --- 2. La caja
  {
    id: "nav-caja",
    path: "*",
    target: '[data-tour="nav-/caja"]',
    title: "Ahora, la caja",
    text: "Para poder vender, primero se abre la caja: es el registro de la plata que entra y sale en el día. Tocá «Caja» en el menú.",
    side: "right",
    advance: { type: "click" },
    goTo: "/caja",
  },
  {
    id: "open-caja",
    path: "/caja",
    target: '[data-tour="open-caja"]',
    title: "Abrí tu caja",
    text: "Tocá el botón «Abrir caja». Si ya la tenés abierta, seguimos de largo.",
    side: "bottom",
    advance: { type: "click" },
    ifMissing: "skip",
    skipTo: "nav-pos",
    waitMs: 1500,
  },
  {
    id: "caja-form",
    path: "/caja",
    target: '[data-tour="caja-form"]',
    title: "Con cuánto efectivo empezás",
    text: "Escribí cuánto efectivo hay en el cajón ahora, por ejemplo los billetes para dar vuelto (si no hay, poné 0). Al cerrar la caja, Pesito compara contra este monto y te dice si sobra o falta. Después tocá «Abrir Caja» (o apretá Enter) para empezar el día.",
    side: "left",
    advance: { type: "gone" },
    ifMissing: "skip",
    skipTo: "nav-pos",
    waitMs: 1500,
  },
  {
    id: "nav-pos",
    path: "*",
    target: '[data-tour="nav-/pos"]',
    title: "A vender",
    text: "Ahora sí: tocá «Vender» para abrir el punto de venta, donde se cobra.",
    side: "right",
    advance: { type: "click" },
    goTo: "/pos",
  },
  {
    id: "sale",
    path: "/pos",
    target: '[data-tour="pos-search"]',
    floating: true,
    title: "Hacé tu primera venta",
    text: "1) Buscá el producto que cargaste (escribí su nombre o escaneá el código) y tocalo para sumarlo al carrito. 2) Tocá «Cobrar», o apretá Enter dos veces. 3) Elegí «Efectivo» (tecla 1); para esta primera venta es la única opción. 4) Escribí con cuánto paga el cliente para ver el vuelto (si paga justo, dejalo vacío) y confirmá con el botón verde o Enter. Después podés cobrar con tarjeta, transferencia, QR, fiado o mixto; los atajos del teclado los ves en el menú (?). Cuando se cobre, vas a poder imprimir el ticket (tecla P); tocá «Nueva venta» (o Enter) para seguir.",
    advance: { type: "cycle", selector: '[data-tour="sale-done"]' },
    ifMissing: "show",
    missingText: "Para vender necesitás la caja abierta. Abrila desde «Caja» y volvé a tocar «Vender».",
    goTo: "/caja",
  },
  // --- 4. Lo que sigue
  {
    id: "nav-compras",
    path: "*",
    target: '[data-tour="nav-/compras"]',
    title: "Cuando te llega mercadería",
    text: "Cuando te llega mercadería, la cargás como una compra y el stock se suma solo. Tocá «Compras» en el menú para entrar.",
    side: "right",
    advance: { type: "click" },
    goTo: "/compras",
  },
  {
    id: "compras-form",
    path: "/compras",
    target: '[data-tour="compras-form"]',
    title: "Compras: así se carga la mercadería",
    text: "Acá registrás lo que te entrega el proveedor: buscás el producto, ponés cantidad y costo, elegís el proveedor y guardás. El stock se suma solo y Pesito se acuerda de cuánto pagaste, así después sabe tu ganancia. No hace falta cargar una ahora: tocá «Siguiente».",
    side: "left",
    advance: { type: "next" },
  },
  {
    id: "nav-clientes",
    path: "*",
    target: '[data-tour="nav-/clientes"]',
    title: "Para anotar el fiado",
    text: "Si le fiás a alguien, necesitás tenerlo cargado como cliente para anotar cuánto te debe. Tocá «Clientes» en el menú.",
    side: "right",
    advance: { type: "click" },
    goTo: "/clientes",
  },
  {
    id: "new-customer",
    path: "/clientes",
    target: '[data-tour="new-customer"]',
    title: "Cargá un cliente",
    text: "Tocá «Nuevo cliente». Después, al cobrar en el punto de venta, elegís «Fiado» y queda anotado lo que te debe. Si no querés cargar uno ahora, tocá «Saltar paso».",
    side: "bottom",
    advance: { type: "click" },
    skipTo: "nav-reportes",
  },
  {
    id: "customer-form",
    path: "/clientes",
    target: '[data-tour="customer-form"]',
    title: "Cargá el cliente",
    text: "Escribí el nombre (es lo único obligatorio; teléfono, DNI y email son opcionales) y tocá «Crear cliente». Si preferís no cargar uno ahora, tocá «Saltar paso».",
    side: "left",
    advance: { type: "gone" },
    ifMissing: "skip",
    skipTo: "nav-reportes",
  },
  {
    id: "nav-reportes",
    path: "*",
    target: '[data-tour="nav-/reportes"]',
    title: "Cómo viene el negocio",
    text: "Acá ves cuánto vendiste y qué se vende más. Tocá «Reportes» en el menú.",
    side: "right",
    advance: { type: "click" },
    goTo: "/reportes",
  },
  {
    id: "finish",
    path: "/reportes",
    title: "Tus reportes y listo",
    text: "Acá vas a poder ver cuánto vendiste, con qué te pagan, qué productos se venden más, quién te debe y cómo está tu stock, por día, semana o mes (la ganancia estimada es del Plan Pro). Ya sabés lo principal: productos, caja, ventas, compras y clientes. Al terminar el día, cerrá la caja desde «Caja»: contás el efectivo y Pesito te dice si sobra o falta. Podés repetir esta guía cuando quieras desde el botón de ayuda (?).",
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
