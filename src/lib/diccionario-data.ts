export interface GlossaryTerm {
  slug: string;
  term: string;
  definition: string;
  /** Cómo lo resuelve Pesito puntualmente — sólo cuando suma algo real. */
  pesito?: string;
}

export interface GlossaryCategory {
  id: string;
  title: string;
  terms: GlossaryTerm[];
}

export const glossaryCategories: GlossaryCategory[] = [
  {
    id: "ventas-facturacion",
    title: "Ventas y facturación",
    terms: [
      {
        slug: "punto-de-venta",
        term: "Punto de venta (POS)",
        definition:
          "El lugar donde se concreta una venta: el mostrador, la caja registradora o, hoy, el sistema que usás para cobrar. \"POS\" es la sigla en inglés (point of sale) y en Argentina se usa indistintamente para el mostrador físico o el software.",
        pesito: "El POS de Pesito es la pantalla donde escaneás o buscás productos y cobrás.",
      },
      {
        slug: "ticket-de-venta",
        term: "Ticket de venta",
        definition:
          "El comprobante que el negocio le entrega al cliente después de cada venta. No tiene validez fiscal por sí solo — es un resumen interno de qué se compró y cuánto se pagó, distinto de una factura.",
      },
      {
        slug: "consumidor-final",
        term: "Consumidor Final",
        definition:
          "La condición de IVA de la mayoría de la gente que compra en un comercio de barrio: no está inscripta como responsable de IVA ni como monotributista frente a esa compra puntual. Es el comprobante por defecto cuando no hace falta discriminar impuestos.",
      },
      {
        slug: "factura-a",
        term: "Factura A",
        definition:
          "Comprobante que emite un responsable inscripto en IVA a otro responsable inscripto. Discrimina el IVA por separado del precio, porque el que compra después lo va a usar como crédito fiscal.",
      },
      {
        slug: "factura-b",
        term: "Factura B",
        definition:
          "Comprobante que emite un responsable inscripto a un consumidor final o a un monotributista. El IVA va incluido en el precio, sin discriminarse por separado en el comprobante.",
      },
      {
        slug: "factura-c",
        term: "Factura C",
        definition:
          "Comprobante que emite un monotributista, sin discriminar IVA (porque no lo cobra). La mayoría de los comercios chicos que facturan, facturan C.",
      },
      {
        slug: "cae",
        term: "CAE (Código de Autorización Electrónico)",
        definition:
          "El código que le asigna ARCA a cada factura electrónica para que sea válida. Sin CAE, una factura emitida por sistema no tiene validez fiscal — es el equivalente digital al timbrado de una factura de papel.",
        pesito: "Con facturación electrónica activada, Pesito pide el CAE automáticamente al emitir.",
      },
      {
        slug: "nota-de-credito",
        term: "Nota de crédito",
        definition:
          "El comprobante que anula, total o parcialmente, una factura ya emitida — por una devolución, un error de carga o una venta que se cancela. Sin nota de crédito, una factura anulada queda \"viva\" para la AFIP/ARCA aunque el negocio ya no la reconozca.",
        pesito: "Cuando anulás una venta facturada en Pesito, se genera la nota de crédito correspondiente.",
      },
      {
        slug: "remito",
        term: "Remito",
        definition:
          "El comprobante que acompaña una mercadería mientras se traslada (de un depósito a un local, de un proveedor al negocio), sin ser en sí mismo una factura. Certifica qué se movió y en qué cantidad, no necesariamente cuánto se pagó.",
      },
      {
        slug: "medio-de-pago",
        term: "Medio de pago",
        definition:
          "La forma en que el cliente paga: efectivo, tarjeta, transferencia, QR, o cualquier billetera o app que uses habitualmente. Un mismo negocio suele combinar varios, y algunos rubros (como las farmacias) usan más de uno en la misma venta.",
        pesito: "Además de los medios fijos, en Pesito podés cargar tus propios medios de pago desde Configuración.",
      },
    ],
  },
  {
    id: "stock-compras",
    title: "Stock y compras",
    terms: [
      {
        slug: "stock",
        term: "Stock",
        definition:
          "La cantidad disponible de cada producto en un momento dado. Llevar el stock al día es lo que te permite saber, sin ir a mirar la góndola, si te queda o no un producto.",
      },
      {
        slug: "quiebre-de-stock",
        term: "Quiebre de stock",
        definition:
          "El momento en que un producto se queda en cero y ya no se puede vender, aunque haya demanda. Es una de las formas más comunes de perder ventas sin darse cuenta, sobre todo si nadie está mirando el stock activamente.",
        pesito: "Inventario en Pesito te avisa qué productos están sin stock o por debajo del mínimo que definiste.",
      },
      {
        slug: "sku",
        term: "SKU / código interno",
        definition:
          "Un identificador único que le asigna el propio negocio (o el sistema) a cada producto, distinto del código de barras de fábrica. Sirve para productos sin código de barras — como los que se venden sueltos o por peso — o para variantes propias.",
      },
      {
        slug: "codigo-de-barras",
        term: "Código de barras",
        definition:
          "El número que identifica un producto a nivel comercial (normalmente de 13 dígitos, formato EAN-13), impreso por el fabricante. Se lee con lector físico, con la cámara del celular, o se puede escribir a mano si el código no se lee bien.",
      },
      {
        slug: "costo",
        term: "Costo",
        definition:
          "Lo que le costó al negocio conseguir un producto — lo que se le pagó al proveedor, no el precio al que se vende. Sin cargar el costo, ningún sistema puede calcularte ganancia real, sólo ingresos.",
      },
      {
        slug: "margen",
        term: "Margen (y la diferencia con markup)",
        definition:
          "La diferencia entre el precio de venta y el costo, expresada como porcentaje. Ojo: \"margen\" (sobre el precio de venta) y \"markup\" o \"recargo\" (sobre el costo) dan números distintos para la misma ganancia — mezclarlos es un error común al armar precios.",
      },
      {
        slug: "variante-de-producto",
        term: "Variante de producto",
        definition:
          "Una versión de un mismo producto que cambia en talle, color, sabor o gramaje (una gaseosa de 500ml y de 2.25L, una remera en S/M/L). Cargarlas como variantes de un mismo producto, en vez de productos sueltos sin relación, ordena mucho el catálogo.",
        pesito: "Pesito permite cargar productos por unidad, peso o variantes, según cómo vendas cada cosa.",
      },
    ],
  },
  {
    id: "caja-clientes",
    title: "Caja y clientes",
    terms: [
      {
        slug: "arqueo-de-caja",
        term: "Arqueo de caja",
        definition:
          "Contar físicamente el efectivo (y revisar los otros medios de pago) que hay en la caja al cerrar, y compararlo contra lo que el sistema dice que debería haber según las ventas registradas. La diferencia, si la hay, es lo que se llama faltante o sobrante de caja.",
        pesito: "Al cerrar tu caja en Pesito, el sistema te muestra el total esperado y te sugiere los billetes para armarlo.",
      },
      {
        slug: "fiado",
        term: "Fiado / cuenta corriente",
        definition:
          "Una venta que el cliente no paga en el momento, quedando registrada como una deuda a su nombre para cobrarla después. Es una práctica muy arraigada en el comercio de barrio, y perderle el rastro a mano (en un cuaderno) es una de las causas más comunes de plata que se pierde sin que nadie note cómo.",
        pesito: "Pesito lleva la cuenta corriente de cada cliente y te avisa cuánto te debe cada uno.",
      },
      {
        slug: "vuelto",
        term: "Vuelto",
        definition:
          "La diferencia entre lo que el cliente entrega en efectivo y el total de la compra. Parece trivial pero calcularlo mal (o de más, por apuro) es una pérdida silenciosa que se repite muchas veces al día en un local con mucho movimiento.",
      },
    ],
  },
  {
    id: "sistemas-de-gestion",
    title: "Sistemas de gestión",
    terms: [
      {
        slug: "erp",
        term: "ERP (Enterprise Resource Planning)",
        definition:
          "Un sistema de gestión integral pensado para empresas medianas o grandes: junta finanzas, producción, recursos humanos, logística y más en una sola plataforma, normalmente con un costo e implementación grandes. Para un comercio de barrio, es mucho más de lo que hace falta — un POS enfocado cubre lo que un ERP resolvería, sin la complejidad.",
      },
      {
        slug: "crm",
        term: "CRM (Customer Relationship Management)",
        definition:
          "Un sistema pensado para gestionar relaciones comerciales complejas: seguimiento de leads, equipos de venta, embudos de conversión. Un comercio de barrio no necesita un CRM — necesita saber quién le debe y qué le compra seguido, que es justamente lo que hace un buen módulo de clientes dentro de un POS.",
      },
      {
        slug: "catalogo-online",
        term: "Catálogo online",
        definition:
          "Una vidriera digital con tus productos y precios, para que tus clientes la vean desde el celu — sin que eso signifique necesariamente vender por ese medio. Sirve para que te consulten precio o stock por WhatsApp sin que tengas que estar respondiendo uno por uno.",
      },
    ],
  },
];
