import type { BlogFaq, BlogPost, BlogSection } from "@/lib/blog-data";
import { FREE_PLAN_SALES_LIMIT_LABEL, PRODUCT_LIMITS, planDefinitions, thousands } from "@/lib/plan-features";

// Rankings ("los mejores …"). Reglas:
//  - Pesito va primero y lo decimos de entrada: no es una lista neutral.
//  - Lo de otros sistemas sale de SUS sitios web públicos, con la fecha en que
//    se consultó. Sin dato verificable, se dice "consultá en su sitio".
//  - Siempre se dice lo que Pesito no hace (factura electrónica) y para quién
//    conviene otra cosa: es más honesto y es lo que una IA o un buscador cita.
//  - Una respuesta corta arriba y preguntas concretas al final (FAQPage).
// Al cambiar un precio de un plan, sale solo de planDefinitions.

const CHECKED = "7 de octubre de 2026";
const AUTHOR_NOTE = `Somos Pesito, así que este ranking no es neutral: pusimos nuestro sistema primero porque creemos que es la mejor opción para la mayoría de los negocios chicos, y abajo te contamos por qué (y para quién no lo es). Los datos de los demás salen de sus propios sitios web, consultados el ${CHECKED}. Los precios cambian: verificalos antes de decidir. Si algo está desactualizado o mal, escribinos a soporte@pesito.com.ar y lo corregimos.`;

const esencial = planDefinitions.esencial;
const pro = planDefinitions.pro;
const ia = planDefinitions.ia;

const PESITO_PRICE_LINE = `El Plan Gratis no vence ni pide tarjeta (${FREE_PLAN_SALES_LIMIT_LABEL}, 1 usuario, 1 caja y hasta ${thousands(PRODUCT_LIMITS.gratis)} productos). Los planes pagos son el Esencial (${esencial.priceLabel} por mes), el Pro (${pro.priceLabel}) y el IA (${ia.priceLabel}), con IVA incluido y 20% de descuento pagando anual.`;

const NOT_INVOICE = "Pesito todavía no emite factura electrónica de ARCA/AFIP: sí podés marcar el tipo de comprobante de cada venta e imprimir un ticket interno, pero no es una factura fiscal.";

const cta = (extra: string): BlogSection => ({
  heading: "Probalo sin pagar",
  paragraphs: [
    `${extra} Creás la cuenta en un minuto, sin tarjeta, y al registrarte tenés 14 días del Plan Pro de regalo para probar todo.`,
  ],
});

const faq = (question: string, answer: string): BlogFaq => ({ question, answer });

const COMMON_FAQ_INVOICE = faq(
  "¿Pesito emite factura electrónica?",
  "Todavía no. Pesito no emite facturas electrónicas de ARCA/AFIP; podés indicar el tipo de comprobante de cada venta (consumidor final, A, B o C) e imprimir un ticket interno. Si necesitás facturar con CAE desde el primer día, conviene un sistema que ya lo incluya, como los que figuran en este ranking con esa función."
);

export const rankingPosts: BlogPost[] = [
  // -------------------------------------------------------------------------
  {
    slug: "mejores-sistemas-punto-de-venta-kioscos-argentina",
    seoTitle: "Mejores sistemas POS para kioscos en Argentina",
    title: "Los mejores sistemas de punto de venta para kioscos en Argentina (2026)",
    excerpt:
      "Ranking 2026 de sistemas de punto de venta para kioscos argentinos: precio, plan gratis, fiado, factura electrónica y para quién conviene cada uno.",
    publishedAt: "2026-10-07",
    readingMinutes: 8,
    quickAnswer: `Para la mayoría de los kioscos en Argentina, el mejor sistema es Pesito: tiene un plan gratis permanente (${FREE_PLAN_SALES_LIMIT_LABEL}), fiado con cuenta corriente, caja diaria, stock y compras desde el navegador o el celular, y los planes pagos arrancan en ${esencial.priceLabel} por mes. Si necesitás emitir factura electrónica de ARCA desde el primer día, mirá CajaOS o Líder Gestión: Pesito todavía no la emite.`,
    ranking: ["Pesito", "DonKiosco", "CajaOS", "Gestión Comercio", "Líder Gestión"],
    sections: [
      {
        paragraphs: [
          "Un kiosco no necesita lo mismo que un supermercado: necesita cobrar rápido, no perder el hilo del fiado, saber qué se está acabando y cerrar la caja sin dolores de cabeza. Elegir mal el sistema se paga caro, porque cambiar después implica volver a cargar todo.",
          AUTHOR_NOTE,
        ],
      },
      {
        heading: "Cómo armamos el ranking",
        paragraphs: ["Ordenamos los sistemas con seis criterios pensados para un kiosco, no para una empresa grande:"],
        list: [
          "Precio publicado y si hay un plan gratis de verdad (sin fecha de vencimiento).",
          "Si funciona sin instalar nada en una computadora (navegador o celular).",
          "Fiado y cuenta corriente de clientes como función propia.",
          "Caja diaria, diferencias y control por empleado.",
          "Stock con mínimos y compras a proveedores.",
          "Facturación electrónica de ARCA: la marcamos aparte porque con ese criterio el orden cambia.",
        ],
      },
      {
        heading: "Comparación rápida",
        paragraphs: [`Datos públicos de cada sitio, consultados el ${CHECKED}.`],
        table: {
          headers: ["Sistema", "Cómo se usa", "Plan gratis", "Precio publicado", "Factura electrónica ARCA"],
          rows: [
            ["Pesito", "Navegador y celular", `Sí, permanente (${FREE_PLAN_SALES_LIMIT_LABEL})`, `Desde ${esencial.priceLabel} por mes`, "Todavía no"],
            ["DonKiosco", "App Android y web", "Sí (hasta 50 productos)", "Planes pagos desde $9.900 por mes", "No, según su sitio"],
            ["CajaOS", "Web", "No: 14 días de prueba", "Plan Starter $35.000 por mes", "Sí, incluida"],
            ["Gestión Comercio", "Software de gestión", "Consultá en su sitio", "Licencia permanente de pago único ($596.000)", "Consultá en su sitio"],
            ["Líder Gestión", "ERP para pymes", "Consultá en su sitio", "Licencia perpetua desde $588.000 en cuotas", "Sí"],
          ],
        },
      },
      {
        heading: "1. Pesito: el mejor para empezar gratis y ordenar todo el kiosco",
        paragraphs: [
          "Pesito es un sistema de punto de venta en la nube hecho para negocios argentinos: se usa desde el navegador o el celular, sin instalar nada. Vendés con lector de código de barras o buscando por nombre, el vuelto se calcula solo y cada venta descuenta stock.",
          PESITO_PRICE_LINE,
          "Lo que lo pone primero para un kiosco: el fiado es una forma de cobro más, con cuenta corriente por cliente, pagos parciales y un panel que te dice cuánto te deben, hace cuánto y quiénes, con un botón para recordarles la deuda por WhatsApp. Además lleva la caja diaria con diferencias, las compras a proveedores (con vencimientos y calendario de pagos desde el Plan Esencial) y el stock con aviso de faltantes. Desde el Plan Esencial podés cargar tus productos y tus clientes desde Excel, y el soporte es por WhatsApp con una persona, no un bot.",
          `A tener en cuenta: ${NOT_INVOICE} Y como funciona desde la nube, necesita conexión a internet.`,
        ],
      },
      {
        heading: "2. DonKiosco: buena opción gratis desde el celular",
        paragraphs: [
          "Según su sitio, DonKiosco es una app para Android con panel web, con plan gratuito permanente (hasta 50 productos), planes pagos desde $9.900 por mes y fiado a clientes.",
          "Conviene si tenés pocos productos y querés arrancar sin pagar desde el celular. A tener en cuenta: el límite de 50 productos del plan gratis se queda corto para un kiosco con surtido normal, y según su propio sitio todavía no emite factura electrónica.",
        ],
      },
      {
        heading: "3. CajaOS: si necesitás facturar con ARCA desde el primer día",
        paragraphs: [
          "CajaOS es un sistema 100% web que, según su sitio, incluye la facturación electrónica de ARCA en todos los planes. Publica un plan Starter de $35.000 por mes y 14 días de prueba sin tarjeta.",
          "Es una buena elección si tu prioridad es emitir factura con cada cobro. A tener en cuenta: no tiene plan gratis permanente (solo la prueba) y el precio es más del doble que el del Plan Esencial de Pesito.",
        ],
      },
      {
        heading: "4. Gestión Comercio: licencia de pago único",
        paragraphs: [
          "Gestión Comercio es un software de gestión comercial que, según su sitio, incluye punto de venta con stock en tiempo real, precios, promociones y reportes, y se vende con una licencia permanente de pago único (publicada en $596.000).",
          "Puede convenir si preferís pagar una sola vez y no una suscripción. A tener en cuenta: no encontramos un plan gratis ni una prueba publicada, así que conviene pedir una demo antes de pagar un monto grande.",
        ],
      },
      {
        heading: "5. Líder Gestión: para negocios más grandes o con varias cajas",
        paragraphs: [
          "Líder Gestión es un ERP para pymes con ventas, facturación electrónica de ARCA, stock, compras, tesorería y cuenta corriente, con licencia perpetua desde $588.000 en cuotas según su sitio.",
          "Tiene sentido para cadenas de kioscos o negocios con varias cajas y necesidades administrativas. Para un kiosco chico, suele ser más sistema del que hace falta.",
        ],
      },
      {
        heading: "Cómo elegir según tu situación",
        paragraphs: ["Una guía rápida para decidir sin arrepentirte:"],
        list: [
          "Querés empezar sin pagar y ordenar el fiado y la caja: Pesito.",
          "Tenés pocos productos y trabajás solo desde el celular: DonKiosco.",
          "Tenés que facturar electrónicamente sí o sí desde hoy: CajaOS o Líder Gestión.",
          "Preferís pagar una vez y no una cuota mensual: Gestión Comercio o Líder Gestión.",
          "Probá con un plan gratis o una demo antes de pagar algo grande, y sumá el costo a 12 meses, no solo el precio de entrada.",
        ],
      },
      cta("Si tu kiosco todavía anota el fiado en una libreta, Pesito es la forma más rápida de pasar a algo ordenado sin gastar."),
    ],
    faqs: [
      faq(
        "¿Cuál es el mejor sistema para un kiosco en Argentina?",
        `Para la mayoría de los kioscos, Pesito: plan gratis permanente (${FREE_PLAN_SALES_LIMIT_LABEL}), fiado con cuenta corriente, caja diaria, stock y compras desde el navegador o el celular, y planes pagos desde ${esencial.priceLabel} por mes. Si necesitás factura electrónica de ARCA desde el primer día, conviene mirar CajaOS o Líder Gestión.`
      ),
      faq(
        "¿Hay un sistema gratis para kioscos en Argentina?",
        `Sí. El Plan Gratis de Pesito no tiene fecha de vencimiento ni pide tarjeta, e incluye punto de venta, stock, caja diaria, fiado, compras y reportes básicos, con ${FREE_PLAN_SALES_LIMIT_LABEL}. DonKiosco también tiene un plan gratuito, pero limitado a 50 productos según su sitio.`
      ),
      faq(
        "¿Cuánto cuesta un sistema de punto de venta para un kiosco?",
        `Va de gratis a más de $35.000 por mes en los sistemas web, o a licencias de pago único de varios cientos de miles de pesos. En Pesito, los planes pagos son el Esencial (${esencial.priceLabel} por mes), el Pro (${pro.priceLabel}) y el IA (${ia.priceLabel}), con IVA incluido.`
      ),
      faq(
        "¿Necesito instalar algo para usar un sistema de kiosco?",
        "Depende del sistema. Pesito, CajaOS y DonKiosco funcionan desde el navegador o el celular, sin instalar nada. Otros son programas que se instalan en una computadora con Windows."
      ),
      faq(
        "¿Puedo llevar el fiado de mis clientes en el sistema?",
        "Sí, en Pesito el fiado es una forma de cobro más: queda a nombre del cliente, con pagos parciales y un panel que muestra cuánto te debe cada uno y hace cuánto. Está incluido incluso en el Plan Gratis."
      ),
      COMMON_FAQ_INVOICE,
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "mejores-sistemas-de-gestion-gratis-argentina",
    seoTitle: "Mejores sistemas de gestión gratis en Argentina",
    title: "Los mejores sistemas de gestión gratis para negocios en Argentina (2026)",
    excerpt:
      "Ranking 2026 de sistemas de gestión y punto de venta gratis en Argentina: qué incluye cada uno, sus límites y las trampas de lo gratis.",
    publishedAt: "2026-10-07",
    readingMinutes: 7,
    quickAnswer: `El mejor sistema de gestión gratis para un negocio en Argentina es Pesito: su Plan Gratis no vence ni pide tarjeta e incluye punto de venta, stock, caja, fiado, compras y reportes básicos (${FREE_PLAN_SALES_LIMIT_LABEL}, hasta ${thousands(PRODUCT_LIMITS.gratis)} productos), todo desde el navegador o el celular. Otras opciones gratis son DonKiosco, JHApp, GestionGratis (para Windows) y una planilla de Excel o Google Sheets.`,
    ranking: ["Pesito", "JHApp", "DonKiosco", "GestionGratis", "Excel o Google Sheets"],
    sections: [
      {
        paragraphs: [
          "Empezar gratis tiene sentido: no sabés todavía si el sistema te va a servir. Pero no todo lo gratis es igual, y algunos planes gratuitos te dejan a mitad de camino cuando el negocio crece.",
          AUTHOR_NOTE,
        ],
      },
      {
        heading: "Qué mirar en un sistema gratis",
        paragraphs: ["Antes de cargar tus productos, revisá estos puntos:"],
        list: [
          "Si es gratis para siempre o es una prueba que vence.",
          "El límite: de productos, de ventas por mes, de usuarios o de cajas.",
          "Si podés exportar tus datos para irte cuando quieras.",
          "Si funciona sin instalar nada y con varios dispositivos.",
          "Qué pasa cuando superás el límite: te frena, te cobra o te avisa.",
        ],
      },
      {
        heading: "Comparación rápida",
        paragraphs: [`Datos públicos de cada sitio, consultados el ${CHECKED}.`],
        table: {
          headers: ["Sistema", "Cómo se usa", "Gratis para siempre", "Límite del plan gratis"],
          rows: [
            ["Pesito", "Navegador y celular", "Sí", `${FREE_PLAN_SALES_LIMIT_LABEL}, 1 usuario, 1 caja, ${thousands(PRODUCT_LIMITS.gratis)} productos`],
            ["JHApp", "Cualquier dispositivo", "Sí, según su sitio", "Consultá en su sitio"],
            ["DonKiosco", "App Android y web", "Sí", "Hasta 50 productos"],
            ["GestionGratis", "Programa para Windows", "Sí, 100% gratuito según su sitio", "Se instala en una sola computadora"],
            ["Excel o Google Sheets", "Planilla", "Sí", "No calcula stock ni caja solo"],
          ],
        },
      },
      {
        heading: "1. Pesito: el plan gratis más completo para empezar",
        paragraphs: [
          "El Plan Gratis de Pesito incluye lo que en otros sistemas suele ser pago: fiado con cuenta corriente, caja diaria con diferencias, compras a proveedores y reportes básicos, además del punto de venta y el stock. No vence y no pide tarjeta.",
          PESITO_PRICE_LINE,
          "Cuando el negocio crece, subís de plan sin recargar nada: los datos siguen donde estaban. Y desde el Plan Esencial podés cargar y exportar tus productos y tus clientes con Excel.",
          `A tener en cuenta: ${NOT_INVOICE}`,
        ],
      },
      {
        heading: "2. JHApp: gratis y pensado para comercios",
        paragraphs: [
          "Según su sitio, JHApp es un programa para kiosco, almacén y comercio que se puede empezar gratis, con ventas, stock, cuentas corrientes y cierre de caja desde cualquier dispositivo.",
          "Es una alternativa razonable si querés comparar. Antes de cargar todo, consultá en su sitio los límites del plan gratis y cómo se exportan los datos.",
        ],
      },
      {
        heading: "3. DonKiosco: gratis, pero con tope de productos",
        paragraphs: [
          "DonKiosco tiene un plan gratuito permanente para kioscos desde el celular, con un tope de 50 productos según su sitio. Sirve para probar o para un puesto muy chico; si tu surtido es más grande, vas a tener que pasar a un plan pago.",
        ],
      },
      {
        heading: "4. GestionGratis: programa para Windows",
        paragraphs: [
          "GestionGratis se presenta como un sistema de gestión, stock y punto de venta 100% gratuito para kioscos, almacenes y comercios, que se descarga para Windows.",
          "A tener en cuenta: al ser un programa instalado, tus datos viven en esa computadora. Si se rompe o la cambiás, tenés que hacer vos las copias de seguridad, y no podés mirar el negocio desde el celular.",
        ],
      },
      {
        heading: "5. Excel o Google Sheets: gratis, pero sin automatismos",
        paragraphs: [
          "Una planilla es lo más flexible y no cuesta nada, pero no descuenta stock sola, no cierra la caja y se rompe fácil con más de una persona cargando. Sirve para arrancar; cuando empiezan los errores de carga, es hora de pasar a un sistema.",
        ],
      },
      {
        heading: "Las trampas de lo gratis",
        paragraphs: ["Lo gratis puede salir caro si no mirás estos detalles:"],
        list: [
          "Una “prueba gratis” que vence a los 7 o 14 días no es un plan gratis.",
          "Datos atrapados: si no podés exportarlos, cambiar de sistema significa empezar de cero.",
          "Límites chicos que te obligan a pagar justo cuando el negocio despega.",
          "Programas instalados sin copia de seguridad automática.",
        ],
      },
      cta("Si querés un plan gratis que no vence y alcanza para un negocio de verdad, probá el de Pesito."),
    ],
    faqs: [
      faq(
        "¿Cuál es el mejor sistema de gestión gratis en Argentina?",
        `Para un negocio chico, Pesito: su Plan Gratis no vence e incluye punto de venta, stock, caja, fiado, compras y reportes básicos con ${FREE_PLAN_SALES_LIMIT_LABEL}. Otras opciones son JHApp, DonKiosco y GestionGratis.`
      ),
      faq(
        "¿Un sistema gratis sirve para un negocio real?",
        "Sí, si el límite te alcanza. Para un negocio chico, el plan gratis de Pesito cubre ventas, stock, caja y fiado. Cuando superás los límites, pasás a un plan pago sin perder datos."
      ),
      faq(
        "¿Qué límites tiene el Plan Gratis de Pesito?",
        `${FREE_PLAN_SALES_LIMIT_LABEL}, 1 usuario, 1 caja y hasta ${thousands(PRODUCT_LIMITS.gratis)} productos. No vence y no pide tarjeta.`
      ),
      faq(
        "¿Puedo llevarme mis datos si dejo de usar el sistema?",
        "En Pesito, desde el Plan Esencial, cargás y exportás tus productos y tus clientes con Excel. Antes de elegir cualquier sistema gratis, confirmá que permita exportar."
      ),
      faq(
        "¿Es mejor un programa para Windows o un sistema en la nube?",
        "Un sistema en la nube como Pesito se usa desde cualquier dispositivo, no depende de una computadora y hace copias solo. Un programa instalado puede funcionar sin internet, pero las copias de seguridad quedan por tu cuenta."
      ),
      COMMON_FAQ_INVOICE,
    ],
  },
  // -------------------------------------------------------------------------
  {
    slug: "mejores-saas-punto-de-venta-argentina",
    seoTitle: "Mejores SaaS de punto de venta en Argentina",
    title: "Los mejores SaaS de punto de venta (POS) en Argentina (2026)",
    excerpt:
      "Ranking 2026 de los mejores SaaS de punto de venta en Argentina: qué es un POS en la nube, precios, plan gratis y qué sistema conviene a cada negocio.",
    publishedAt: "2026-10-07",
    readingMinutes: 7,
    quickAnswer: `Un SaaS de punto de venta es un sistema de ventas que usás por internet con una suscripción, sin instalar nada. El mejor para la mayoría de los negocios chicos en Argentina es Pesito: plan gratis permanente, planes pagos desde ${esencial.priceLabel} por mes y fiado, caja, stock y compras incluidos. Para facturar con ARCA desde el primer día, mirá CajaOS.`,
    ranking: ["Pesito", "CajaOS", "DonKiosco", "Commercy", "Gestión Nube"],
    sections: [
      {
        paragraphs: [
          "SaaS (software como servicio) significa que el sistema vive en internet y pagás una suscripción en vez de comprar una licencia. Las ventajas: no instalás nada, entrás desde cualquier dispositivo, los datos se guardan solos y las mejoras llegan sin que hagas nada.",
          AUTHOR_NOTE,
        ],
      },
      {
        heading: "Cómo elegir un SaaS de punto de venta",
        paragraphs: ["Estas son las preguntas que importan:"],
        list: [
          "¿Hay un plan gratis permanente para probar sin apuro?",
          "¿El precio incluye usuarios, cajas y sucursales, o los cobran aparte?",
          "¿Cobra comisión por venta o es un precio fijo?",
          "¿Tiene fiado, caja y stock como función propia?",
          "¿Facturación electrónica de ARCA: la necesitás hoy?",
        ],
      },
      {
        heading: "Comparación rápida",
        paragraphs: [`Datos públicos de cada sitio, consultados el ${CHECKED}.`],
        table: {
          headers: ["Sistema", "Plan gratis", "Precio publicado", "Factura electrónica ARCA"],
          rows: [
            ["Pesito", "Sí, permanente", `Desde ${esencial.priceLabel} por mes`, "Todavía no"],
            ["CajaOS", "No: 14 días de prueba", "Starter $35.000 por mes", "Sí, incluida"],
            ["DonKiosco", "Sí (hasta 50 productos)", "Desde $9.900 por mes", "No, según su sitio"],
            ["Commercy", "Consultá en su sitio", "Plan fijo, sin comisión por venta", "Consultá en su sitio"],
            ["Gestión Nube", "Consultá en su sitio", "Consultá en su sitio", "Consultá en su sitio"],
          ],
        },
      },
      {
        heading: "1. Pesito: el SaaS de punto de venta con mejor costo para empezar",
        paragraphs: [
          "Pesito reúne punto de venta, stock, caja diaria, fiado, compras a proveedores y reportes en un solo sistema web, hecho para Argentina (pesos, voseo, WhatsApp). No cobra comisión por venta: pagás un plan fijo o usás el gratis.",
          PESITO_PRICE_LINE,
          "Los planes superiores suman más usuarios y cajas, reportes avanzados y, en el Plan IA, 2 sucursales y herramientas con IA (qué reponer, sugerencia de precios). Si tu negocio crece, el precio sube por planes claros y no por cada empleado o caja suelta.",
          `A tener en cuenta: ${NOT_INVOICE}`,
        ],
      },
      {
        heading: "2. CajaOS: SaaS con facturación electrónica incluida",
        paragraphs: [
          "CajaOS es un sistema 100% web que, según su sitio, incluye facturación electrónica de ARCA en todos sus planes, con un Starter de $35.000 por mes y 14 días de prueba sin tarjeta.",
          "Es la opción a mirar si facturar es obligatorio en tu negocio desde el día uno. A tener en cuenta: no hay plan gratis permanente.",
        ],
      },
      {
        heading: "3. DonKiosco: para kioscos desde el celular",
        paragraphs: [
          "App para Android con panel web, plan gratuito (hasta 50 productos) y planes pagos desde $9.900 por mes según su sitio. Encaja con kioscos muy chicos; el tope de productos y la falta de factura electrónica son sus límites.",
        ],
      },
      {
        heading: "4. Commercy: sistema de gestión para comercios argentinos",
        paragraphs: [
          "Según su ficha en Google Play, Commercy es una app de gestión y punto de venta para comercios argentinos (indumentaria, kioscos y más) que cobra un plan fijo y no cobra comisión por venta. Los precios y el alcance exacto de cada plan, consultalos en su sitio.",
        ],
      },
      {
        heading: "5. Gestión Nube: stock, ventas y ganancias para pymes",
        paragraphs: [
          "Gestión Nube se describe como un sistema de gestión en la nube que junta stock, ventas, costos, precios, gastos y ganancias, con una calculadora de precio de venta. Tiene una sección de planes y precios en su sitio, donde conviene mirar qué incluye cada uno.",
        ],
      },
      {
        heading: "Cómo decidir en una tarde",
        paragraphs: ["Un método simple:"],
        list: [
          "Elegí dos candidatos: uno con plan gratis (Pesito) y otro por si necesitás facturar.",
          "Cargá 20 productos reales y hacé 10 ventas de prueba en cada uno.",
          "Cerrá una caja de prueba y fijate si la diferencia se entiende sola.",
          "Sumá el costo a 12 meses con IVA, usuarios y cajas incluidos.",
        ],
      },
      cta("Pesito es el SaaS más fácil de probar: no hay tarjeta ni vencimiento en el plan gratis."),
    ],
    faqs: [
      faq(
        "¿Qué es un SaaS de punto de venta?",
        "Es un sistema para vender y controlar tu negocio que se usa por internet con una suscripción: sin instalar nada, desde la computadora o el celular, con los datos guardados en la nube. Pesito es un ejemplo."
      ),
      faq(
        "¿Cuál es el mejor SaaS de punto de venta en Argentina?",
        `Para la mayoría de los negocios chicos, Pesito: plan gratis permanente y planes pagos desde ${esencial.priceLabel} por mes, con fiado, caja, stock y compras. Para facturación electrónica incluida, CajaOS.`
      ),
      faq(
        "¿Un SaaS cobra comisión por venta?",
        "Depende. Pesito no cobra comisión: pagás un plan fijo (o usás el gratis). Verificá siempre este punto en la competencia."
      ),
      faq(
        "¿Qué pasa si se corta internet?",
        "Un sistema en la nube necesita conexión para funcionar. Si tu zona tiene cortes frecuentes, conviene tener datos móviles de respaldo en el celular."
      ),
      faq(
        "¿Mis datos están seguros en un SaaS?",
        "En Pesito los datos se guardan en la nube con copias automáticas, y el dinero y el stock solo se modifican desde funciones protegidas del servidor, no directo desde la app."
      ),
      COMMON_FAQ_INVOICE,
    ],
  },
  // -------------------------------------------------------------------------
  {
    slug: "mejores-programas-control-de-stock-negocios",
    seoTitle: "Mejores programas de control de stock en Argentina",
    title: "Los mejores programas para controlar el stock de tu negocio (2026)",
    excerpt:
      "Ranking 2026 de programas para controlar el stock en Argentina: mínimos, alertas, ventas que descuentan solas y cuál conviene según tu negocio.",
    publishedAt: "2026-10-07",
    readingMinutes: 6,
    quickAnswer: `El mejor programa para controlar el stock en un negocio chico es Pesito: cada venta descuenta stock sola, registra las compras, avisa lo que se está acabando (desde el Plan Esencial) y tiene plan gratis permanente. Para negocios con facturación electrónica obligatoria, Gestión Comercio o Gestión Nube pueden complementar según lo que publican en sus sitios.`,
    ranking: ["Pesito", "Gestión Nube", "Gestión Comercio", "GestionGratis", "Excel o Google Sheets"],
    sections: [
      {
        paragraphs: [
          "Controlar el stock es saber qué tenés, qué se vende y qué reponer antes de quedarte sin nada. Hecho a mano, los errores de carga se acumulan; un sistema bien configurado los evita.",
          AUTHOR_NOTE,
        ],
      },
      {
        heading: "Qué tiene que hacer un buen programa de stock",
        paragraphs: ["Los cinco puntos que revisamos:"],
        list: [
          "Descontar stock automáticamente en cada venta.",
          "Avisar cuando un producto llega al mínimo.",
          "Registrar compras que suman stock y actualizan costos.",
          "Permitir ajustes con motivo (merma, rotura, vencimiento).",
          "Importar y exportar productos desde Excel.",
        ],
      },
      {
        heading: "Comparación rápida",
        paragraphs: [`Datos públicos de cada sitio, consultados el ${CHECKED}.`],
        table: {
          headers: ["Sistema", "Cómo se usa", "Plan gratis", "Stock automático por venta"],
          rows: [
            ["Pesito", "Navegador y celular", "Sí, permanente", "Sí, con alerta de mínimos"],
            ["Gestión Nube", "Nube", "Consultá en su sitio", "Sí, según su sitio"],
            ["Gestión Comercio", "Software de gestión", "Consultá en su sitio", "Sí, en tiempo real según su sitio"],
            ["GestionGratis", "Programa para Windows", "Sí, gratuito", "Sí, según su sitio"],
            ["Excel o Google Sheets", "Planilla", "Sí", "No, hay que cargarlo a mano"],
          ],
        },
      },
      {
        heading: "1. Pesito: stock que se actualiza solo y avisa antes de quedarte sin nada",
        paragraphs: [
          "En Pesito, cada venta descuenta stock y cada compra lo suma, incluso en el Plan Gratis. Desde el Plan Esencial definís un mínimo por producto, ves el aviso de faltantes y la lista para reponer, y tenés el historial de movimientos; con el Plan IA, cada sucursal tiene su propio stock. Cargás y exportás productos desde Excel.",
          PESITO_PRICE_LINE,
          `A tener en cuenta: ${NOT_INVOICE}`,
        ],
      },
      {
        heading: "2. Gestión Nube: stock, costos y ganancias en un lugar",
        paragraphs: [
          "Según su sitio, reúne stock, ventas, costos, precios, gastos y ganancias, con consulta de stock y precios al instante. Mirá en su sección de planes qué incluye cada uno.",
        ],
      },
      {
        heading: "3. Gestión Comercio: stock en tiempo real con licencia de pago único",
        paragraphs: [
          "Gestión Comercio publica punto de venta con stock en tiempo real, promociones y reportes, con licencia permanente de pago único ($596.000 según su sitio).",
        ],
      },
      {
        heading: "4. GestionGratis: stock gratis, instalado en tu computadora",
        paragraphs: [
          "Programa para Windows, gratuito según su sitio, para kioscos, almacenes y comercios. Sirve para un solo puesto; los datos quedan en esa máquina y las copias de seguridad dependen de vos.",
        ],
      },
      {
        heading: "5. Excel o Google Sheets: para empezar, no para escalar",
        paragraphs: [
          "Una planilla funciona con pocos productos y una sola persona. No descuenta por venta ni avisa mínimos; cuando el inventario no cierra con el estante, es la señal para pasar a un sistema.",
        ],
      },
      {
        heading: "Hábitos que mejoran cualquier sistema",
        paragraphs: ["Con el programa que elijas, estos hábitos hacen la diferencia:"],
        list: [
          "Hacer un conteo físico de los productos más caros cada mes.",
          "Definir un mínimo por producto según cuánto tarda en llegar la mercadería.",
          "Cargar la compra el mismo día que llega.",
          "Anotar las mermas con motivo, no restar a ciegas.",
        ],
      },
      cta("Cargá tus productos y empezá a ver tus faltantes hoy mismo."),
    ],
    faqs: [
      faq(
        "¿Cuál es el mejor programa para controlar el stock de un negocio?",
        "Para un negocio chico, Pesito: descuenta stock en cada venta, suma las compras, avisa los mínimos desde el Plan Esencial y tiene plan gratis permanente."
      ),
      faq(
        "¿El stock se descuenta solo cuando vendo?",
        "En Pesito sí: cada venta descuenta stock y cada compra lo suma. Las correcciones se hacen con un ajuste y su motivo."
      ),
      faq(
        "¿Cómo sé qué producto reponer?",
        "Desde el Plan Esencial definís un stock mínimo por producto y Pesito te muestra los que están por debajo, con una lista para reponer. En el Plan Gratis el stock igual se descuenta en cada venta."
      ),
      faq(
        "¿Puedo importar mis productos desde Excel?",
        "Sí, desde el Plan Esencial: Pesito importa y exporta productos desde Excel, con costos y precios, para que no tengas que cargarlos uno por uno."
      ),
      faq(
        "¿Se puede ver el stock por sucursal?",
        "Sí, en el Plan IA: tiene 2 sucursales, cada una con su propio stock, y podés pasar mercadería de una a otra."
      ),
    ],
  },
  // -------------------------------------------------------------------------
  {
    slug: "mejores-sistemas-para-llevar-el-fiado",
    seoTitle: "Mejores sistemas para llevar el fiado en Argentina",
    title: "Los mejores sistemas para llevar el fiado y las cuentas corrientes (2026)",
    excerpt:
      "Ranking 2026 de sistemas para controlar el fiado y la cuenta corriente de tus clientes: recordatorios, pagos parciales y qué conviene a cada negocio.",
    publishedAt: "2026-10-07",
    readingMinutes: 6,
    quickAnswer: `El mejor sistema para llevar el fiado en un negocio chico es Pesito: el fiado es una forma de cobro más, con cuenta corriente por cliente, pagos parciales, un panel de cuánto te deben y hace cuánto, y recordatorio por WhatsApp. Está incluido en el Plan Gratis. Otras opciones son JHApp, DonKiosco, Líder Gestión y la libreta.`,
    ranking: ["Pesito", "JHApp", "DonKiosco", "Líder Gestión", "Libreta o planilla"],
    sections: [
      {
        paragraphs: [
          "El fiado es una forma de vender y fidelizar, pero mal llevado se convierte en plata perdida: deudas que nadie recuerda, cuentas que no cierran, clientes que se acumulan. Un sistema te dice quién debe, cuánto y desde cuándo.",
          AUTHOR_NOTE,
        ],
      },
      {
        heading: "Qué tiene que hacer un buen sistema de fiado",
        paragraphs: ["Los puntos clave:"],
        list: [
          "Cuenta corriente por cliente con historial.",
          "Pagos parciales, no solo “paga todo o nada”.",
          "Un panel de deuda total, antigüedad y quiénes deben.",
          "Aviso o recordatorio al cliente (por ejemplo, por WhatsApp).",
          "Un límite de crédito por cliente para no pasarte.",
        ],
      },
      {
        heading: "Comparación rápida",
        paragraphs: [`Datos públicos de cada sitio, consultados el ${CHECKED}.`],
        table: {
          headers: ["Sistema", "Cuenta corriente", "Plan gratis", "Notas"],
          rows: [
            ["Pesito", "Sí, con pagos parciales y panel de deuda", "Sí, permanente", "Recordatorio por WhatsApp"],
            ["JHApp", "Sí, según su sitio", "Sí, según su sitio", "Consultá el detalle en su sitio"],
            ["DonKiosco", "Sí, fiado a clientes", "Sí (hasta 50 productos)", "Pensado para kioscos"],
            ["Líder Gestión", "Sí, cuenta corriente", "Consultá en su sitio", "ERP para pymes, licencia perpetua"],
            ["Libreta o planilla", "A mano", "Sí", "Sin avisos ni totales automáticos"],
          ],
        },
      },
      {
        heading: "1. Pesito: el fiado integrado a la venta y a la caja",
        paragraphs: [
          "En Pesito, fiar es elegir “fiado” al cobrar: la deuda queda a nombre del cliente. Después registrás pagos parciales y el saldo se actualiza solo. El panel de Clientes muestra cuánto te deben, hace cuánto, quiénes son, con filtros y columnas, y un botón para recordarles la deuda por WhatsApp.",
          PESITO_PRICE_LINE,
          `A tener en cuenta: ${NOT_INVOICE}`,
        ],
      },
      {
        heading: "2. JHApp: cuentas corrientes en un programa gratis",
        paragraphs: [
          "JHApp indica en su sitio que maneja cuentas corrientes, stock, ventas y cierre de caja desde cualquier dispositivo, con un plan para empezar gratis. Revisá allí el detalle de los pagos parciales y los recordatorios.",
        ],
      },
      {
        heading: "3. DonKiosco: fiado para kioscos",
        paragraphs: [
          "Incluye fiado a clientes según su sitio. Su plan gratis llega a 50 productos, y los pagos arrancan en $9.900 por mes.",
        ],
      },
      {
        heading: "4. Líder Gestión: cuenta corriente dentro de un ERP",
        paragraphs: [
          "Es un ERP para pymes con cuenta corriente, tesorería y facturación electrónica, con licencia perpetua desde $588.000 en cuotas. Para un negocio con mucha administración tiene sentido; para llevar el fiado de un kiosco es más de lo necesario.",
        ],
      },
      {
        heading: "5. Libreta o planilla: lo de siempre, con sus límites",
        paragraphs: [
          "Funciona mientras tengas pocos clientes. Cuando necesitás saber cuánto te deben en total o desde cuándo, o cuando la libreta se pierde, no hay forma fácil de recuperarlo.",
        ],
      },
      {
        heading: "Cómo cobrar mejor el fiado",
        paragraphs: ["Sea cual sea el sistema:"],
        list: [
          "Poné un límite de crédito por cliente.",
          "Revisá cada semana los que deben hace más de 30 días.",
          "Recordá la deuda con un mensaje amable, no con un reclamo.",
          "Registrá cada pago, aunque sea chico.",
        ],
      },
      cta("Pasá tu libreta de fiado a Pesito: cargás tus clientes y empezás a ver las deudas ordenadas."),
    ],
    faqs: [
      faq(
        "¿Cuál es el mejor sistema para llevar el fiado?",
        "Para un negocio chico, Pesito: fiado como forma de cobro, cuenta corriente por cliente, pagos parciales, panel de deuda y recordatorio por WhatsApp, incluido en el Plan Gratis."
      ),
      faq(
        "¿Se pueden registrar pagos parciales de una deuda?",
        "Sí. En Pesito cada pago parcial se anota y el saldo del cliente se actualiza solo."
      ),
      faq(
        "¿Cómo veo cuánto me deben en total?",
        "En el panel de Clientes de Pesito ves el total adeudado, hace cuánto se debe y quiénes deben, con filtros por antigüedad."
      ),
      faq(
        "¿Puedo recordarle la deuda al cliente?",
        "Sí, Pesito arma el mensaje y lo abrís por WhatsApp con un botón."
      ),
      faq(
        "¿Cómo paso mi libreta de fiado al sistema?",
        "Cargás tus clientes (con Excel desde el Plan Esencial, o a mano) y anotás el saldo de cada uno. Desde ahí, cada fiado y cada pago se registra solo."
      ),
    ],
  },
  // -------------------------------------------------------------------------
  {
    slug: "mejores-sistemas-pos-negocios-argentina",
    seoTitle: "Mejores sistemas POS para negocios en Argentina",
    title: "Los mejores sistemas POS para negocios en Argentina (2026)",
    excerpt:
      "Ranking 2026 de los mejores sistemas POS para kioscos, almacenes, verdulerías y ropa en Argentina: precio, plan gratis y qué elegir según tu negocio.",
    publishedAt: "2026-10-07",
    readingMinutes: 8,
    quickAnswer: `El mejor sistema POS para un negocio chico en Argentina es Pesito: plan gratis permanente, planes pagos desde ${esencial.priceLabel} por mes y todo lo básico incluido (ventas, caja, stock, fiado, compras, reportes). Si necesitás factura electrónica de ARCA desde el primer día, CajaOS o Líder Gestión; si preferís pagar una sola vez, Gestión Comercio.`,
    ranking: ["Pesito", "CajaOS", "Commercy", "DonKiosco", "Gestión Comercio", "Líder Gestión"],
    sections: [
      {
        paragraphs: [
          "Un sistema POS (punto de venta) es el que usás para cobrar, y hoy además lleva el stock, la caja y los clientes. La mejor elección depende del tipo de negocio, de si necesitás facturar con ARCA y de cuánto querés gastar.",
          AUTHOR_NOTE,
        ],
      },
      {
        heading: "Comparación rápida",
        paragraphs: [`Datos públicos de cada sitio, consultados el ${CHECKED}.`],
        table: {
          headers: ["Sistema", "Plan gratis", "Precio publicado", "Factura electrónica ARCA", "Ideal para"],
          rows: [
            ["Pesito", "Sí, permanente", `Desde ${esencial.priceLabel} por mes`, "Todavía no", "Kioscos, almacenes, verdulerías, ropa"],
            ["CajaOS", "No: 14 días de prueba", "Starter $35.000 por mes", "Sí, incluida", "Quien factura con cada cobro"],
            ["Commercy", "Consultá en su sitio", "Plan fijo, sin comisión", "Consultá en su sitio", "Indumentaria y kioscos"],
            ["DonKiosco", "Sí (hasta 50 productos)", "Desde $9.900 por mes", "No, según su sitio", "Kioscos chicos"],
            ["Gestión Comercio", "Consultá en su sitio", "Pago único $596.000", "Consultá en su sitio", "Quien prefiere licencia"],
            ["Líder Gestión", "Consultá en su sitio", "Desde $588.000 en cuotas", "Sí", "Pymes con administración"],
          ],
        },
      },
      {
        heading: "1. Pesito: el mejor costo-beneficio para un negocio chico",
        paragraphs: [
          "Pesito suma en un solo sistema web: punto de venta con lector de código de barras, stock con mínimos, caja diaria con diferencias, fiado, compras a proveedores, reportes de ganancia (desde el Plan Pro) y, en los planes superiores, más cajas y usuarios y, en el Plan IA, 2 sucursales y herramientas con IA.",
          PESITO_PRICE_LINE,
          "Funciona igual para un kiosco, un almacén, una verdulería o un local de ropa, y el soporte es una persona por WhatsApp.",
          `A tener en cuenta: ${NOT_INVOICE}`,
        ],
      },
      {
        heading: "2. CajaOS: facturación electrónica en todos los planes",
        paragraphs: [
          "Sistema web que, según su sitio, incluye facturación de ARCA en todos los planes (Starter $35.000 por mes, 14 días de prueba). Mejor opción si facturar es tu prioridad. No tiene plan gratis permanente.",
        ],
      },
      {
        heading: "3. Commercy: gestión para comercios argentinos",
        paragraphs: [
          "Según su ficha en Google Play, es una app de gestión y punto de venta para comercios argentinos que cobra un plan fijo, sin comisión por venta. Consultá en su sitio los planes y la facturación.",
        ],
      },
      {
        heading: "4. DonKiosco: kioscos desde el celular",
        paragraphs: [
          "Plan gratis hasta 50 productos y planes desde $9.900 por mes, según su sitio. Útil para un kiosco muy chico; no emite factura electrónica según su propio sitio.",
        ],
      },
      {
        heading: "5. Gestión Comercio: pago único",
        paragraphs: [
          "Licencia permanente de pago único publicada en $596.000, con punto de venta, stock en tiempo real, promociones y reportes. Pedí una demo antes de pagar.",
        ],
      },
      {
        heading: "6. Líder Gestión: ERP para pymes",
        paragraphs: [
          "Con facturación de ARCA, stock, compras, tesorería y cuenta corriente, licencia perpetua desde $588.000 en cuotas. Es para negocios con más estructura.",
        ],
      },
      {
        heading: "Qué elegir según tu tipo de negocio",
        paragraphs: ["Atajos para decidir:"],
        list: [
          "Kiosco o almacén con fiado: Pesito.",
          "Verdulería con precios que cambian seguido: Pesito, con aumentos masivos de precios desde el Plan Pro.",
          "Ropa con facturación obligatoria: CajaOS o Líder Gestión.",
          "Puesto muy chico, con poco surtido: DonKiosco o el plan gratis de Pesito.",
          "Pagar una vez: Gestión Comercio.",
        ],
      },
      cta("Probá Pesito con tus propios productos: es la forma más rápida de saber si te sirve."),
    ],
    faqs: [
      faq(
        "¿Cuál es el mejor sistema POS para un negocio en Argentina?",
        `Para la mayoría de los negocios chicos, Pesito: plan gratis permanente y planes pagos desde ${esencial.priceLabel} por mes, con ventas, caja, stock, fiado y compras. Para facturación electrónica, CajaOS o Líder Gestión.`
      ),
      faq(
        "¿Qué es un sistema POS?",
        "Un POS (point of sale, punto de venta) es el sistema con el que cobrás. Los modernos, como Pesito, también controlan stock, caja y clientes."
      ),
      faq(
        "¿Cuánto cuesta un sistema POS en Argentina?",
        `Hay opciones gratis, suscripciones desde unos miles de pesos por mes y licencias de pago único de cientos de miles. En Pesito: Gratis, Esencial (${esencial.priceLabel}), Pro (${pro.priceLabel}) e IA (${ia.priceLabel}) por mes, con IVA incluido.`
      ),
      faq(
        "¿Necesito comprar hardware para usar un POS?",
        "No necesariamente. Pesito funciona desde el navegador o el celular; el lector de código de barras y la impresora de tickets son opcionales."
      ),
      faq(
        "¿Sirve para una verdulería o un local de ropa?",
        "Sí. Pesito vende por unidad o por peso y lleva el stock de cualquier rubro; los aumentos masivos de precios están en el Plan Pro."
      ),
      COMMON_FAQ_INVOICE,
    ],
  },
];
