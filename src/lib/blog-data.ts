export interface BlogSection {
  heading?: string;
  paragraphs: string[];
  list?: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingMinutes: number;
  sections: BlogSection[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "como-armar-lista-de-precios",
    title: "Cómo armar una lista de precios sin perder plata en el camino",
    excerpt:
      "El método simple para ponerle precio a cada producto sin adivinar — y sin regalar margen sin darte cuenta.",
    publishedAt: "2026-08-04",
    readingMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Poner precio \"a ojo\" es de las formas más comunes de perder plata en un comercio chico, y casi nunca se nota en el momento — se nota a fin de mes, cuando la caja no da lo que debería dar. Armar bien la lista de precios no es complicado, pero sí hay que hacerlo con un método, no con el primer número que suena bien.",
        ],
      },
      {
        heading: "Empezá por el costo real, no por lo que compraste",
        paragraphs: [
          "El costo de un producto no es sólo lo que pagaste en la factura del proveedor. Si tuviste que pagar flete, o compraste un bulto grande y lo fraccionás, ese costo también tiene que entrar en la cuenta — sino estás calculando margen sobre un número que no es el real.",
          "Cargar el costo de cada producto (no sólo el precio de venta) es lo que le permite a cualquier sistema — Pesito incluido — decirte cuánto ganaste de verdad, no sólo cuánto vendiste.",
        ],
      },
      {
        heading: "Margen y markup no son lo mismo, y mezclarlos te hace perder plata",
        paragraphs: [
          "Son dos formas de calcular la ganancia, y dan números distintos para la misma plata. El markup se calcula sobre el costo, el margen se calcula sobre el precio de venta.",
          "Ejemplo: un producto que te cuesta $1.000. Si le sumás 50% de markup, lo vendés a $1.500 — pero eso es un margen del 33%, no del 50%. Si lo que querés es un margen del 50% de verdad, el precio tiene que ser $2.000. La confusión entre los dos es una de las causas más comunes de vender con menos ganancia de la que creías tener.",
        ],
      },
      {
        heading: "Redondeá con la caja en mente, no sólo con la psicología del precio",
        paragraphs: [
          "Terminar un precio en $990 en vez de $1.000 puede ayudar a que se perciba más barato, pero en un comercio con mucho efectivo circulando también importa que el número sea fácil de cobrar y dar vuelto. Un precio que termina en una cifra rara complica la caja más de lo que suma en percepción.",
        ],
      },
      {
        heading: "Revisala seguido — no es una lista que se arma una vez",
        paragraphs: [
          "Con la inflación de Argentina, una lista de precios que no se actualiza queda vieja en semanas, no en meses. La diferencia entre un negocio que no pierde margen y uno que sí, muchas veces es simplemente qué tan rápido puede actualizar precios cuando cambia el costo.",
          "En Pesito, cambiar el precio de un producto es instantáneo y se refleja en el Punto de Venta al toque — no hace falta reimprimir nada ni avisarle a nadie.",
        ],
      },
    ],
  },
  {
    slug: "arqueo-de-caja-que-es-como-se-hace",
    title: "Arqueo de caja: qué es, cómo se hace y por qué conviene hacerlo todos los días",
    excerpt:
      "La rutina de cerrar caja que evita sorpresas: paso a paso, y qué hacer cuando el número no cierra.",
    publishedAt: "2026-08-11",
    readingMinutes: 5,
    sections: [
      {
        paragraphs: [
          "El arqueo de caja es, en criollo, contar la plata que tenés al cerrar y compararla contra lo que el sistema (o tus cuentas) dicen que debería haber. Suena simple, y lo es — el problema es cuando no se hace nunca, y un faltante chico de hoy se convierte en un agujero grande de fin de mes.",
        ],
      },
      {
        heading: "Por qué conviene hacerlo todos los días, no una vez por semana",
        paragraphs: [
          "Un faltante de $500 de hoy es fácil de investigar: te acordás de la venta rara, del cliente que pagó justo, del vuelto que diste apurado. El mismo faltante acumulado durante una semana, mezclado con seis días más de movimiento, es imposible de rastrear.",
          "Arquear caja todos los días no es desconfiar de nadie que trabaja con vos — es la única forma de detectar un error (de cualquiera, incluido vos mismo) mientras todavía se puede corregir.",
        ],
      },
      {
        heading: "El paso a paso",
        paragraphs: ["Es siempre el mismo orden, sea un kiosco chico o un local con varios empleados:"],
        list: [
          "Contá físicamente el efectivo que hay en la caja, billete por billete.",
          "Sumá lo cobrado por los demás medios de pago (tarjeta, transferencia, QR) del día.",
          "Compará ese total contra lo que el sistema dice que se vendió en esa caja.",
          "Si no coincide, anotá la diferencia — faltante si hay menos de lo esperado, sobrante si hay de más.",
        ],
      },
      {
        heading: "Si no cierra, no es el fin del mundo — pero hay que investigar",
        paragraphs: [
          "Un faltante chico y ocasional casi siempre tiene una explicación simple: un vuelto mal dado, una venta fiada que no se cargó como tal, un gasto que se pagó con la plata de la caja sin anotarlo. Lo importante es mirarlo el mismo día, cuando todavía te acordás de lo que pasó.",
          "Si el faltante se repite seguido, ahí sí vale la pena revisar el proceso: quién tiene acceso a la caja, si se está registrando bien el fiado, si el vuelto se está calculando a mano.",
        ],
      },
      {
        heading: "Cómo lo hace más fácil un sistema",
        paragraphs: [
          "En Pesito, cerrar la caja te muestra el efectivo esperado según lo que el sistema registró, y una calculadora de billetes te ayuda a contar rápido. Si hay una diferencia, queda guardada en el historial de esa caja — no se pierde ni se mezcla con la del día siguiente.",
        ],
      },
    ],
  },
  {
    slug: "factura-a-b-c-diferencia",
    title: "Factura A, B o C: la diferencia explicada sin vueltas",
    excerpt:
      "Cuál corresponde según quién te compra, qué es el CAE, y si hace falta facturar todas las ventas.",
    publishedAt: "2026-08-18",
    readingMinutes: 5,
    sections: [
      {
        paragraphs: [
          "La letra de la factura (A, B o C) no la elegís vos según te guste una más que otra — depende de la condición frente al IVA de quien vende y de quien compra. Una vez que entendés esa lógica, elegir cuál corresponde deja de ser un misterio.",
        ],
      },
      {
        heading: "Factura A",
        paragraphs: [
          "La emite un responsable inscripto en IVA cuando le vende a otro responsable inscripto. Discrimina el IVA por separado del precio, porque quien compra lo va a usar como crédito fiscal en su propia declaración.",
        ],
      },
      {
        heading: "Factura B",
        paragraphs: [
          "La emite un responsable inscripto cuando le vende a un consumidor final o a un monotributista. El IVA va incluido en el precio, sin desglosarse en el comprobante — es la que ve la mayoría de la gente que compra en un comercio de barrio cuando el que vende está inscripto en IVA.",
        ],
      },
      {
        heading: "Factura C",
        paragraphs: [
          "La emite un monotributista, sin discriminar IVA porque no lo cobra. La mayoría de los kioscos, almacenes y comercios chicos que facturan como monotributistas, facturan C.",
        ],
      },
      {
        heading: "¿Y el CAE?",
        paragraphs: [
          "El CAE (Código de Autorización Electrónico) es el código que le asigna ARCA a cada factura electrónica para que tenga validez. Sin CAE, una factura emitida por sistema no vale como comprobante fiscal — es el equivalente digital al timbrado que antes tenía una factura de papel.",
        ],
      },
      {
        heading: "¿Hace falta facturar todas las ventas?",
        paragraphs: [
          "La mayoría de las ventas de mostrador de un comercio chico van como Consumidor Final, que es el comprobante por defecto cuando no hace falta discriminar impuestos. Facturar A, B o C aplica cuando el cliente lo pide específicamente o cuando el negocio decide activar la facturación electrónica de forma sistemática.",
          "En Pesito, la facturación con CAE es un complemento que se activa cuando lo necesitás — no hace falta migrar de sistema ni frenar las ventas mientras tanto.",
        ],
      },
    ],
  },
  {
    slug: "como-elegir-sistema-para-tu-comercio",
    title: "Cómo elegir un sistema para tu comercio (más allá del precio)",
    excerpt:
      "Las preguntas que de verdad importan antes de dejar el cuaderno o el Excel, para no arrepentirte a los tres meses.",
    publishedAt: "2026-08-25",
    readingMinutes: 6,
    sections: [
      {
        paragraphs: [
          "En algún momento, todo comercio que crece llega al límite del cuaderno, la calculadora y las planillas sueltas. El problema no es reconocer que hace falta un sistema — es elegir bien, porque migrar dos veces (de papel a un sistema, y después de un sistema a otro) sale más caro en tiempo que quedarse un poco más con el cuaderno.",
        ],
      },
      {
        heading: "Las preguntas que importan de verdad",
        paragraphs: [
          "El precio mensual es lo primero que se mira, pero no es lo que más pesa a la larga. Antes de elegir, conviene hacerse estas preguntas:",
        ],
        list: [
          "¿Tiene un plan gratis de verdad, o sólo una prueba con fecha de vencimiento?",
          "¿Lleva el fiado o la cuenta corriente como una función propia del sistema, o hay que anotarlo aparte igual?",
          "¿Sirve para cómo vendés de verdad — por peso, por unidad, con variantes de talle o color?",
          "Cuando algo falla, ¿te contesta una persona o tenés que esperar en una cola de tickets?",
          "¿Podés facturar cuando lo necesites sin que sea todo o nada desde el día uno?",
        ],
      },
      {
        heading: "Errores comunes al elegir",
        paragraphs: [
          "El más común es elegir sólo por precio, sin probar el sistema con productos reales del propio negocio. El segundo es no pensar en cómo se migran los datos que ya tenés (clientes, stock, deudas) — un sistema que no te deja arrancar rápido con lo que ya tenías termina sumando trabajo en vez de sacarlo.",
        ],
      },
      {
        heading: "Por qué te contamos esto siendo Pesito",
        paragraphs: [
          "Porque construimos Pesito pensando exactamente en esas preguntas: plan gratis sin vencimiento, fiado como función central, soporte por WhatsApp con una persona real, y facturación que se activa cuando la necesitás, no antes. No pretendemos ser la única opción — sí que, si las evaluás con esta lista, tengamos con qué responder cada una.",
        ],
      },
    ],
  },
];
