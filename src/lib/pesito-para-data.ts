export interface RubroPage {
  slug: string;
  name: string;
  title: string;
  intro: string;
  painPoints: { title: string; description: string }[];
  examples: string[];
  features: { title: string; description: string }[];
  dayInLife: string;
}

// Rubros con página propia. El resto de los rubros que soporta Pesito
// (business-types.ts) se listan en el hub /pesito-para sin página dedicada
// todavía — se puede sumar más adelante con el mismo formato.
export const rubroPages: RubroPage[] = [
  {
    slug: "kiosco",
    name: "kiosco",
    title: "Pesito para tu kiosco",
    intro:
      "Gaseosa, golosinas, cigarrillos y una fila que no da tregua: en un kiosco cada venta tiene que ser rápida, y lo que se te complica no es vender — es no perder el hilo de todo lo demás mientras vendés.",
    painPoints: [
      {
        title: "El fiado que se pierde en la libreta",
        description:
          "Alguien te dice \"anotámelo\" y dos semanas después ni vos ni él se acuerdan bien cuánto era.",
      },
      {
        title: "El vuelto mal dado en la hora pico",
        description:
          "Con la fila esperando, calcular el vuelto a mano es donde más plata se pierde sin darse cuenta.",
      },
      {
        title: "Quedarte sin lo que más se vende",
        description:
          "Cigarrillos, gaseosas y golosinas se mueven rápido — si nadie está mirando el stock activamente, te quedás sin el producto justo en el momento de más venta.",
      },
    ],
    examples: [
      "Gaseosas y aguas",
      "Golosinas y alfajores",
      "Cigarrillos por unidad o por paquete",
      "Fiambres y lácteos básicos",
      "Recargas y servicios",
    ],
    features: [
      {
        title: "Venta rápida con código de barras o teclado",
        description: "Escaneás o buscás por nombre — lo que sea más rápido en cada momento.",
      },
      {
        title: "Vuelto calculado solo",
        description: "Ingresás con cuánto te pagan y Pesito te dice el vuelto exacto, sin cuentas mentales.",
      },
      {
        title: "Fiado con cuenta corriente por cliente",
        description: "Cada fiado queda registrado a nombre de quien te debe, con lo que cobró y lo que falta.",
      },
      {
        title: "Alertas de stock bajo",
        description: "Te avisa antes de que te quedes sin lo que más rotás.",
      },
    ],
    dayInLife:
      "Es la hora pico y hay cinco personas esperando. Escaneás una gaseosa, sumás dos alfajores a mano porque no tienen código, cobrás en efectivo y el sistema te tira el vuelto justo sin que tengas que pararte a pensar. Uno de tus clientes de siempre te pide que se lo anotes — dos toques y queda en su cuenta, sin que se te mezcle con la del vecino.",
  },
  {
    slug: "almacen",
    name: "almacén",
    title: "Pesito para tu almacén",
    intro:
      "Un almacén mezcla productos envasados con cosas que se venden por peso, mercadería de varios proveedores distintos, y clientes de toda la vida que compran fiado sin que eso sea un problema — al contrario, es parte del trato.",
    painPoints: [
      {
        title: "Productos por peso y por unidad, mezclados",
        description:
          "El fiambre se pesa, la gaseosa no — llevar el stock de las dos formas a la vez en un cuaderno es de las cosas más difíciles de sostener.",
      },
      {
        title: "Varios proveedores, cada uno con su ritmo",
        description:
          "Saber qué le compraste a quién y cuánto le debés a cada proveedor, sin mezclarlo todo.",
      },
      {
        title: "Cuentas corrientes de clientes habituales",
        description:
          "El almacén de barrio vive del cliente que vuelve — y ese cliente casi siempre tiene una cuenta corriente que hay que llevar bien.",
      },
    ],
    examples: [
      "Fiambres y quesos por peso",
      "Almacén seco (fideos, arroz, aceite)",
      "Bebidas y gaseosas",
      "Productos de limpieza",
      "Panificados",
    ],
    features: [
      {
        title: "Productos por unidad, peso o variante",
        description: "Cargás cada producto como se vende de verdad, sin forzar todo al mismo formato.",
      },
      {
        title: "Compras y proveedores",
        description: "Registrás lo que le comprás a cada proveedor y el stock se suma solo.",
      },
      {
        title: "Cuenta corriente de clientes",
        description: "Vas viendo quién te debe y cuánto, sin tener que preguntarle a nadie.",
      },
      {
        title: "Reportes de mejores clientes y productos",
        description: "Sabés qué se vende más y quién te compra más, sin tener que sumarlo a mano.",
      },
    ],
    dayInLife:
      "A la mañana te llega mercadería de un proveedor: la cargás como compra y el stock se actualiza solo, sin tener que ir producto por producto a mano. Durante el día pesás fiambre, vendés gaseosas por unidad y a la tarde un cliente de siempre te paga parte de lo que te debía — se lo descontás de su cuenta y seguís.",
  },
  {
    slug: "verduleria",
    name: "verdulería",
    title: "Pesito para tu verdulería",
    intro:
      "En una verdulería casi todo se vende por kilo, la mercadería entra y se vende rápido, y el margen se cuida centavo a centavo — no hay tiempo para sistemas que compliquen algo que tiene que ser instantáneo.",
    painPoints: [
      {
        title: "Pesar y cobrar sin perder tiempo",
        description: "Con el cliente esperando en el mostrador, cada segundo que se pierde cargando un precio cuenta.",
      },
      {
        title: "Mercadería que rota rápido",
        description: "Lo que hoy tenés en cantidad, en dos días puede estar agotado o dado vuelta.",
      },
      {
        title: "El fiado del cliente de todos los días",
        description: "El marcadito de siempre que se lleva la bolsa y paga los viernes — hay que llevarlo bien, sin que se pierda.",
      },
    ],
    examples: [
      "Papa, tomate, cebolla por kilo",
      "Banana, manzana, naranja por kilo",
      "Ajo, limón, morrón por unidad",
      "Verdura de hoja",
      "Huevos por docena o media docena",
    ],
    features: [
      {
        title: "Venta por peso",
        description: "Cargás el kilaje y el sistema calcula el precio al toque, sin cuentas a mano.",
      },
      {
        title: "Alta rápida de producto nuevo",
        description: "Si llega algo que no tenías cargado, lo sumás desde la pantalla de Compras en el momento.",
      },
      {
        title: "Control de stock al día",
        description: "Sabés qué te queda sin tener que ir a mirar el cajón.",
      },
      {
        title: "Fiado con cuenta corriente",
        description: "El cliente de siempre queda con su cuenta clara, sin anotador aparte.",
      },
    ],
    dayInLife:
      "Llega un cliente y pide medio kilo de tomate, dos limones y una banana — cargás el peso, el sistema calcula el total y cobrás en quince segundos. A media mañana te llega un cajón de verdura nueva que no tenías cargada: la das de alta ahí mismo, sin frenar la venta del mostrador.",
  },
  {
    slug: "indumentaria",
    name: "indumentaria",
    title: "Pesito para tu local de ropa",
    intro:
      "En indumentaria cada prenda no es un producto, son varios: el mismo buzo en tres talles y dos colores. Saber qué combinación te queda y cuál no es la diferencia entre vender y no tener el talle justo cuando el cliente lo pide.",
    painPoints: [
      {
        title: "Talles y colores como si fueran productos distintos",
        description:
          "Llevar el stock de cada combinación de talle y color a mano es de las cosas que más tiempo consume en un local de ropa.",
      },
      {
        title: "Saber qué prenda no se mueve",
        description: "La ropa que queda colgada temporada tras temporada es plata quieta que nadie nota a tiempo.",
      },
      {
        title: "El cliente que prueba y se lo lleva a cuenta",
        description: "En muchos locales de barrio se separa o se fía una prenda — hay que poder llevarlo con orden.",
      },
    ],
    examples: [
      "Remeras en talle S, M, L y XL",
      "Buzos y camperas por temporada",
      "Jeans por talle y color",
      "Accesorios y calzado",
      "Prendas de una sola talla (ej. gorras, medias)",
    ],
    features: [
      {
        title: "Talles y colores",
        description: "Cargás la prenda una sola vez y elegís los talles y colores: cada combinación queda con su propio SKU, stock y precio, así contás y ajustás el stock de cada variante. Desde el Plan Básico.",
      },
      {
        title: "Detección de baja rotación",
        description: "Con el Plan Max ves qué prendas hace meses no se venden y cuánta plata tenés parada en ellas, para liquidarlas a tiempo.",
      },
      {
        title: "Cuenta corriente de clientes",
        description: "Si separás o fiás una prenda, queda registrado a nombre del cliente.",
      },
      {
        title: "Reportes de productos más vendidos",
        description: "Sabés qué talles y modelos se mueven más para reponer lo que de verdad se vende.",
      },
    ],
    dayInLife:
      "Una clienta pregunta si te queda el mismo buzo en talle M en gris — mirás en Pesito si te queda sin tener que ir al perchero a contar. Se prueba dos prendas, se lleva una y te pide dejarte la otra separada: queda anotada a su nombre, lista para cuando vuelva.",
  },
  {
    slug: "ferreteria",
    name: "ferretería",
    title: "Pesito para tu ferretería",
    intro:
      "Miles de productos chicos, decenas de proveedores y precios que cambian cada semana: en una ferretería lo difícil no es cobrar, es saber qué tenés, a cuánto lo tenés que vender hoy y qué te falta pedir antes de que un cliente se vaya con las manos vacías.",
    painPoints: [
      {
        title: "Los precios que quedan viejos",
        description:
          "Cuando sube un proveedor y no actualizás a tiempo, vendés a un precio que ya no te deja margen. Cambiar producto por producto lleva horas.",
      },
      {
        title: "Tanta variedad que no sabés qué te queda",
        description:
          "Tornillos, mechas, cables, pinturas: con miles de artículos, contar a ojo no alcanza y el faltante aparece cuando el cliente ya está en el mostrador.",
      },
      {
        title: "El cliente que \"te paga a fin de mes\"",
        description:
          "Plomeros, electricistas y constructores suelen comprar a cuenta. Sin un registro claro, la deuda se mezcla y se pierde el rastro de quién debe cuánto.",
      },
    ],
    examples: [
      "Tornillería y bulonería",
      "Herramientas manuales y eléctricas",
      "Materiales eléctricos y de plomería",
      "Pinturas y accesorios",
      "Artículos de seguridad y de jardín",
    ],
    features: [
      {
        title: "Carga masiva con Excel",
        description:
          "Subís tu lista de productos desde una planilla, con costo y porcentaje de ganancia para que el precio se calcule solo. Desde el Plan Básico, hasta 4.000 productos activos.",
      },
      {
        title: "Aumentos de precios por proveedor o marca",
        description:
          "Con el Plan Pro subís o bajás de una vez todos los precios o costos de un proveedor o de una marca, por porcentaje o monto fijo, y lo podés deshacer.",
      },
      {
        title: "Códigos de barras propios y etiquetas",
        description:
          "Para lo que no trae código de fábrica, generás uno propio e imprimís la etiqueta, así escaneás todo al cobrar (Plan Básico).",
      },
      {
        title: "Cuenta corriente de clientes y de proveedores",
        description:
          "Cada venta a cuenta queda a nombre del cliente, y lo que le debés a cada proveedor se ve compra por compra, con su vencimiento (Plan Básico).",
      },
      {
        title: "Avisos de stock bajo",
        description: "Cargás un stock mínimo por producto y Pesito te avisa lo que se está por agotar, antes de que falte.",
      },
    ],
    dayInLife:
      "Un electricista llega a las ocho con una lista: cinta aisladora, fichas, un rollo de cable. Escaneás lo que tiene código, buscás por nombre lo que no, y se lo anotás a su cuenta con dos toques porque paga a fin de mes. A media mañana sube un proveedor: entrás a Pesito, elegís su nombre, subís el 12% a todos sus productos y los precios quedan actualizados en el mismo momento. Antes de cerrar mirás qué productos están por agotarse y armás el pedido.",
  },
  {
    slug: "petshop",
    name: "petshop",
    title: "Pesito para tu petshop",
    intro:
      "Alimento balanceado, accesorios, higiene y clientes que vuelven todos los meses por la misma marca: en un petshop la clave es no quedarte sin el alimento que tu cliente siempre lleva, y acordarte de qué le fiaste a cada uno.",
    painPoints: [
      {
        title: "Quedarte sin el alimento que todos piden",
        description:
          "Si tu cliente de siempre llega y no está su marca, probablemente la compre en otro lado esa misma tarde y no vuelva por ella.",
      },
      {
        title: "Clientes de confianza que pagan después",
        description:
          "Es común anotar a clientes fijos. En un cuaderno es fácil perder el hilo de cuánto debe cada uno y desde cuándo.",
      },
      {
        title: "Productos que se compran en bultos",
        description:
          "Comprás por fardo o por bolsa grande y vendés por unidad: sin un control claro, el stock real y el que figura se van despegando.",
      },
    ],
    examples: [
      "Alimento balanceado para perros y gatos",
      "Snacks y huesos",
      "Accesorios, collares y camas",
      "Higiene, piedras sanitarias y shampoos",
      "Productos de acuario y aves",
    ],
    features: [
      {
        title: "Stock mínimo y avisos de reposición",
        description:
          "Cargás el mínimo de cada alimento y Pesito te avisa cuando está por agotarse. Con el Plan Max, además, arma el pedido por proveedor para enviarlo por WhatsApp.",
      },
      {
        title: "Presentación y unidades por bulto",
        description:
          "Cargás cómo viene cada producto (por ejemplo, un fardo de 12) para que los pedidos que sugiere Pesito se calculen en bultos enteros.",
      },
      {
        title: "Fiado con cuenta corriente y recordatorio por WhatsApp",
        description:
          "Cada deuda queda a nombre del cliente, y desde la lista de clientes le podés recordar lo que debe por WhatsApp.",
      },
      {
        title: "Kits y combos",
        description:
          "Armás un kit (por ejemplo, alimento más snack) con su propio precio: al venderlo, Pesito descuenta el stock de cada producto que lleva (Plan Básico).",
      },
    ],
    dayInLife:
      "Entra una clienta de siempre por la bolsa de alimento de su perro. La escaneás, cobrás en efectivo y el vuelto sale calculado. Otro cliente se lleva un kit de cepillo y shampoo que armaste como combo, y te pide anotarlo hasta el viernes. Al final del día mirás los productos por agotarse: la marca que más rota está en el mínimo, así que la sumás al pedido del proveedor.",
  },
  {
    slug: "belleza",
    name: "negocio de artículos de belleza",
    title: "Pesito para tu negocio de artículos de belleza",
    intro:
      "Cosmética, maquillaje, accesorios para el pelo, perfumería: muchos productos chicos, muchos tonos y marcas, y una caja que se mueve con ventas de poco valor. Lo difícil es saber qué tono se terminó, qué marca deja más margen y qué lleva meses sin venderse.",
    painPoints: [
      {
        title: "Un mismo producto en muchos tonos",
        description:
          "Un labial o una base vienen en una docena de colores. Contarlos uno por uno, y saber cuál se vende más, es un trabajo que se hace a mano y se desactualiza enseguida.",
      },
      {
        title: "Margen distinto según la marca",
        description:
          "No todas las marcas dejan lo mismo. Sin cargar el costo de cada producto, no sabés cuáles te convienen empujar.",
      },
      {
        title: "Mercadería que se queda en la vitrina",
        description:
          "Lo que no rota ocupa lugar y plata. Detectarlo a tiempo permite liquidarlo antes de que pierda valor.",
      },
    ],
    examples: [
      "Maquillaje y cosmética",
      "Perfumería y fragancias",
      "Cuidado del pelo y de la piel",
      "Esmaltes y accesorios de uñas",
      "Accesorios para el pelo",
    ],
    features: [
      {
        title: "Colores y tonos como variantes",
        description:
          "Cargás el producto una sola vez y elegís sus colores: cada tono queda con su SKU, su stock y su precio, y en el Punto de Venta se elige desde una grilla (Plan Básico).",
      },
      {
        title: "Costo y ganancia por producto",
        description:
          "Si cargás el costo, el sistema te muestra cuánto ganás con cada producto y cuáles se venden a pérdida. Los reportes de ganancia son del Plan Pro.",
      },
      {
        title: "Kits y combos",
        description:
          "Armás sets de regalo con su precio propio: al vender el combo se descuenta el stock de cada producto que lleva (Plan Básico).",
      },
      {
        title: "Detección de baja rotación",
        description: "Con el Plan Max ves qué productos hace meses no se venden y cuánta plata tenés parada en ellos.",
      },
    ],
    dayInLife:
      "Una clienta busca su base en un tono puntual. Buscás el producto, abrís la grilla de colores y ves cuántas unidades quedan de ese tono. Se lleva también un set de regalo que armaste como combo. Al cerrar el día revisás qué tonos quedaron en cero y los agregás al pedido al proveedor, que cargás cuando llega la mercadería para que el stock suba solo.",
  },
  {
    slug: "accesorios",
    name: "negocio de accesorios",
    title: "Pesito para tu negocio de accesorios",
    intro:
      "Bijouterie, carteras, gorros, fundas, relojes: miles de artículos parecidos, de bajo valor y de mucha rotación por temporada. Lo difícil es controlar el stock de cada modelo y color, y no inmovilizar plata en lo que no se vende.",
    painPoints: [
      {
        title: "Muchos modelos, muchos colores",
        description:
          "Cada artículo viene en varias versiones. Si todo se carga como un producto distinto, la lista se vuelve imposible de manejar.",
      },
      {
        title: "Rotación por temporada",
        description:
          "Lo que se vendió muy bien en verano puede quedar parado en invierno. Sin datos, es difícil decidir qué reponer y qué liquidar.",
      },
      {
        title: "Ventas chicas y muchas",
        description:
          "Con tickets de bajo valor y mucho movimiento, cualquier error de vuelto o de precio se acumula a fin de mes.",
      },
    ],
    examples: [
      "Bijouterie y joyería de fantasía",
      "Carteras, mochilas y billeteras",
      "Gorros, bufandas y guantes",
      "Fundas y accesorios de celular",
      "Relojes y anteojos",
    ],
    features: [
      {
        title: "Modelos con colores y talles",
        description:
          "Cargás cada modelo una vez y elegís sus colores o talles: cada combinación queda con su stock y su precio, y cuenta como un solo producto para el máximo de tu plan (Plan Básico).",
      },
      {
        title: "Vuelto calculado y ventas rápidas",
        description: "Escaneás o buscás por nombre, ingresás con cuánto te pagan y Pesito calcula el vuelto exacto.",
      },
      {
        title: "Productos más vendidos y baja rotación",
        description:
          "Los reportes te muestran qué se vende más; con el Plan Max, además, qué lleva meses parado y cuánta plata tenés en eso.",
      },
      {
        title: "Aumentos masivos de precios",
        description:
          "Con el Plan Pro ajustás los precios de una marca o proveedor de una sola vez, y podés deshacerlo si te equivocaste.",
      },
    ],
    dayInLife:
      "Un cliente quiere una cartera en negro. La buscás, ves en la grilla qué colores quedan y la cobrás en dos toques. Más tarde, otra se lleva tres accesorios chicos y paga con transferencia. A fin de mes mirás los productos más vendidos y los que no rotan, y con eso decidís qué reponer para la próxima temporada.",
  },
];
