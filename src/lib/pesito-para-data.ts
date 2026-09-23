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
        title: "Variantes de producto",
        description: "Cargás talle y color como variantes de una misma prenda, sin duplicar el catálogo.",
      },
      {
        title: "Detección de baja rotación",
        description: "El plan IA te avisa qué prendas no se están vendiendo, para que puedas liquidarlas a tiempo.",
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
      "Una clienta pregunta si te queda el mismo buzo en talle M en gris — mirás el stock de esa variante puntual sin tener que ir al perchero a contar. Se prueba dos prendas, se lleva una y te pide dejarte la otra separada: queda anotada a su nombre, lista para cuando vuelva.",
  },
];
