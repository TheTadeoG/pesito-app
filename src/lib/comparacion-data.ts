export interface ComparisonBlock {
  slug: string;
  feature: string;
  otros: string;
  pesito: string;
}

// Comparación por funcionalidad, no por marca puntual: describe un patrón
// general de "otros sistemas" (sin nombrar a nadie) y cómo lo resuelve
// Pesito distinto. Frases en general/"suele" a propósito, para no afirmar
// algo que no podamos sostener de un sistema que no nombramos.
export const comparisonBlocks: ComparisonBlock[] = [
  {
    slug: "fiado",
    feature: "Fiado y cuentas corrientes",
    otros:
      "En muchos sistemas de gestión el fiado no existe como función propia, o hay que llevarlo aparte en un cuaderno o una planilla — justo la parte que más plata hace perder cuando se pierde el rastro.",
    pesito:
      "En Pesito la cuenta corriente de cada cliente es parte del sistema: sabés cuánto te debe cada uno, registrás pagos parciales y esa deuda sale directo de una venta, sin cargarla dos veces.",
  },
  {
    slug: "plan-gratis",
    feature: "Plan gratis",
    otros:
      "La mayoría de los sistemas de punto de venta ofrecen una prueba gratis de 7 o 14 días y después sí o sí hay que pagar para seguir usándolo.",
    pesito:
      "El plan gratis de Pesito no es una prueba con fecha de vencimiento: es un plan permanente, con hasta 150 ventas por mes. Pasás a un plan pago cuando tu negocio lo necesita, no porque se venció un plazo.",
  },
  {
    slug: "medios-de-pago",
    feature: "Medios de pago",
    otros:
      "La lista de medios de pago suele venir fija de fábrica: efectivo, tarjeta, transferencia — y listo. Si cobrás con una billetera virtual puntual, no queda identificada como tal.",
    pesito:
      "En Pesito podés cargar tus propios medios de pago (Mercado Pago, Ualá, o el que uses) desde Configuración, y aparecen junto a los de siempre tanto al vender como al comprar.",
  },
  {
    slug: "facturacion-electronica",
    feature: "Facturación electrónica",
    otros:
      "Activar la facturación suele ser un trámite aparte, con un proveedor distinto y una integración que hay que pedirle a alguien que la configure.",
    pesito:
      "En Pesito la facturación con CAE es un complemento que activás cuando la necesitás, sin migrar de sistema. Mientras tanto, podés vender y llevar tu negocio al día igual.",
  },
  {
    slug: "cualquier-rubro",
    feature: "Un mismo sistema para cualquier rubro",
    otros:
      "Muchos sistemas de punto de venta están pensados para un solo tipo de negocio (gastronomía, indumentaria) y el resto de los rubros tienen que forzar el uso de campos que no les cierran del todo.",
    pesito:
      "Pesito soporta productos por unidad, por peso o con variantes (talle, color, gramaje) desde el mismo catálogo — sirve igual para un kiosco, una verdulería o un local de ropa.",
  },
  {
    slug: "soporte",
    feature: "Soporte",
    otros:
      "El soporte de muchos sistemas pasa por un formulario, un ticket o un bot, con tiempos de espera que no siempre están claros de antemano.",
    pesito:
      "En Pesito escribís por WhatsApp y te contesta una persona del equipo, no un bot. Sin pasar por un formulario primero.",
  },
];
