import { FREE_PLAN_SALES_LIMIT_LABEL, planDefinitions } from "@/lib/plan-features";

export interface Faq {
  question: string;
  answer: string;
}

export interface FaqCategory {
  title: string;
  faqs: Faq[];
}

const { esencial, pro, ia } = planDefinitions;

// Fuente única de las preguntas frecuentes: la landing muestra las
// destacadas (featuredFaqs) y /preguntas-frecuentes todas, por tema. Las
// respuestas describen sólo lo que el sistema hace hoy — lo que todavía no
// existe se dice como tal.
export const faqCategories: FaqCategory[] = [
  {
    title: "Empezar y planes",
    faqs: [
      {
        question: "¿Pesito es gratis?",
        answer: `Sí. El Plan Gratis no tiene costo, no pide tarjeta y no vence. Incluye el punto de venta con lector de códigos, el stock, las compras a proveedores, la caja, los clientes con fiado y reportes básicos de ventas, para 1 usuario y hasta ${FREE_PLAN_SALES_LIMIT_LABEL}. Además, al crear tu cuenta tenés 14 días del Plan Pro de regalo.`,
      },
      {
        question: "¿Qué pasa cuando terminan los 14 días de prueba?",
        answer:
          "Seguís en el Plan Gratis automáticamente: no se te cobra nada y no perdés ningún dato. Lo único que deja de estar disponible son las funciones del Plan Pro (por ejemplo, los aumentos masivos, los reportes avanzados o En vivo), hasta que elijas un plan pago.",
      },
      {
        question: "¿Qué diferencia hay entre los planes?",
        answer: `El ${esencial.name} (${esencial.priceLabel} por mes) suma ventas ilimitadas, el control de stock con mínimos y reposición, la cuenta corriente con tus proveedores, las ventas y diferencias de caja de cada empleado, y hasta 2 usuarios y 2 cajas. El ${pro.name} (${pro.priceLabel} por mes) suma los aumentos masivos de precios y costos, los reportes avanzados (ganancias, ventas a pérdida, comparación de períodos e historial de caja), la pantalla En vivo y hasta 6 usuarios y 6 cajas. El ${ia.name} (${ia.priceLabel} por mes) suma hasta 2 sucursales con su propio stock, soporte prioritario 24/7 y, próximamente, herramientas con inteligencia artificial. Próximamente, el Esencial va a sumar la carga masiva de productos con Excel, productos con variantes (talles y colores), combos y kits; el Pro, importar costos desde Excel, control por usuario (todos los movimientos de stock y de caja de cada uno, con sus diferencias), inventarios físicos, balanzas conectadas, carteles de precios para imprimir, un catálogo online y ofertas y promociones; y el IA, ganancias por sucursal, reportes avanzados con IA, sugerencia de precios y análisis de competidores y del mercado. Pagando anual tenés un 20% de descuento.`,
      },
      {
        question: "¿Necesito instalar algo?",
        answer:
          "No. Pesito funciona desde el navegador en la computadora, la tablet o el celular. Creás tu cuenta y en unos minutos ya podés vender.",
      },
      {
        question: "¿Necesito internet para usar Pesito?",
        answer:
          "Sí, Pesito funciona en la nube: necesitás conexión a internet (wifi o datos) para cobrar, actualizar el stock y ver tus reportes. A cambio, tus datos no dependen de tu computadora: si se rompe o la cambiás, entrás desde otra y está todo.",
      },
      {
        question: "¿Sirve para mi rubro?",
        answer:
          "Sí. Lo usan kioscos, almacenes, verdulerías, fiambrerías, locales de ropa, ferreterías, pet shops, farmacias y cualquier negocio que venda productos. Cargás tus productos (por unidad o por peso) y empezás a vender.",
      },
    ],
  },
  {
    title: "Vender",
    faqs: [
      {
        question: "¿Puedo usar lector de código de barras?",
        answer:
          "Sí. Escaneás el producto y se suma al carrito al instante. Si un producto no tiene código, lo buscás por nombre en el mismo buscador.",
      },
      {
        question: "¿Puedo vender por peso (fiambre, verdura, carne)?",
        answer:
          "Sí. Los productos pueden ser por unidad o por kilo, y al vender cargás la cantidad con decimales (por ejemplo, 0,250 kg). El stock se descuenta en la misma unidad. La conexión con balanzas llega pronto en el Plan Pro.",
      },
      {
        question: "¿Qué medios de pago puedo cobrar?",
        answer:
          "Efectivo (con cálculo del vuelto), tarjeta, transferencia, QR, fiado y pago mixto (una parte en efectivo y otra con otro medio, por ejemplo). También podés sumar tus propios medios de pago, como Cuenta DNI o Mercado Pago, desde Configuración.",
      },
      {
        question: "¿Puedo cobrar algo que no tengo cargado como producto?",
        answer:
          "Sí, con \"monto libre\": cobrás un importe suelto sin tener que dar de alta un producto. También podés aplicar descuentos o recargos a la venta.",
      },
      {
        question: "¿Imprime tickets? ¿Hace factura electrónica?",
        answer:
          "Podés imprimir un ticket de cada venta (es un comprobante interno, no una factura fiscal). Pesito todavía no emite facturas electrónicas de ARCA/AFIP; sí podés marcar a qué tipo de comprobante corresponde cada venta (consumidor final, A, B o C) y guardar los datos fiscales de tus clientes.",
      },
    ],
  },
  {
    title: "Stock, precios y compras",
    faqs: [
      {
        question: "¿Cómo controlo el stock?",
        answer:
          "En todos los planes, cada venta descuenta el stock sola y cada compra lo suma. Desde el Plan Esencial le ponés a cada producto un stock mínimo y Pesito te avisa cuáles están por acabarse, con la lista para reponer; y los ajustes a mano (roturas, vencidos, conteos) quedan registrados con el motivo en el historial de movimientos.",
      },
      {
        question: "¿Puedo subir los precios de todos los productos de una vez?",
        answer: `Sí, con los aumentos masivos del ${pro.name}: elegís un proveedor o una marca, ponés el porcentaje o el monto, y se actualizan en segundos los precios (o los costos) de todos sus productos. Si te equivocaste, lo deshacés. En todos los planes cada producto guarda su historial de precios, y al registrar una compra podés actualizar el precio de venta con el costo nuevo.`,
      },
      {
        question: "¿Puedo registrar las compras a mis proveedores?",
        answer: `Sí, en todos los planes. Al cargar una compra se suma el stock y se actualiza el costo, y la pagás en efectivo desde la caja o con otro medio. Desde el ${esencial.name} también podés dejarla en la cuenta corriente del proveedor y ver cuánto le debés a cada uno.`,
      },
      {
        question: "¿Me dice cuánto gano de verdad?",
        answer: `Sí, con los reportes avanzados del ${pro.name}: si cargás el costo de cada producto, ves la ganancia estimada, los productos que más ganancia te dejan, los que vendés a pérdida y la comparación con el período anterior. En todos los planes tenés los reportes básicos: lo vendido, el ticket promedio, los medios de pago y los productos más vendidos.`,
      },
    ],
  },
  {
    title: "Caja, equipo y sucursales",
    faqs: [
      {
        question: "¿Cada empleado tiene su propia caja?",
        answer:
          "Sí. Cada usuario abre y cierra su caja con su monto inicial de efectivo. Durante el turno se registran los retiros e ingresos, y al cerrar se cuenta el efectivo (con una calculadora de billetes) y Pesito te muestra si hubo faltante o sobrante. El Plan Gratis tiene 1 usuario con su caja, el Esencial hasta 2 y el Pro hasta 6.",
      },
      {
        question: "¿Mis empleados necesitan tener email?",
        answer:
          "No. Podés crearles un usuario y contraseña desde Pesito (por ejemplo, juan#1234), o invitarlos con un link. Cada uno tiene un rol: vendedor (vende, carga compras y ve el catálogo) o administrador.",
      },
      {
        question: "¿Puedo ver cómo va el negocio sin estar en el local?",
        answer:
          "Sí, con la pantalla En vivo del Plan Pro, desde el celular o la compu: cuánto se vendió hoy, la comparación con ayer a la misma hora, cada sucursal, cada vendedor con su caja y las últimas ventas. Se actualiza sola cada 30 segundos mientras la mirás.",
      },
      {
        question: "¿Sirve si tengo varias sucursales?",
        answer: `Sí, con el ${ia.name}, que incluye hasta 2 sucursales. Cada sucursal tiene su propio stock y sus cajas, cada vendedor trabaja en la suya y podés pasar mercadería de una sucursal a otra. Desde En vivo ves cuánto vende cada una en el momento. Si tenés más sucursales, escribinos por WhatsApp.`,
      },
      {
        question: "¿Cómo sé si falta plata en la caja?",
        answer:
          "Al cerrar la caja contás el efectivo y Pesito lo compara con lo que debería haber (monto inicial + ventas en efectivo + cobros − retiros y pagos). Si no coincide, queda registrada la diferencia de ese vendedor. Desde el Plan Esencial, en los reportes ves los faltantes y sobrantes de cada persona.",
      },
    ],
  },
  {
    title: "Clientes y fiado",
    faqs: [
      {
        question: "¿Qué pasa si un cliente me debe (fiado)?",
        answer:
          "Cobrás la venta como \"fiado\" a nombre del cliente y Pesito le lleva la cuenta corriente. Cuando te paga, registrás el pago (todo o una parte) y el saldo se actualiza. En los reportes ves quién te debe y hace cuánto no paga.",
      },
      {
        question: "¿Puedo guardar los datos fiscales de un cliente?",
        answer:
          "Sí: nombre, razón social, documento o CUIT, teléfono y el tipo de comprobante que le corresponde, para tenerlo a mano en cada venta.",
      },
    ],
  },
  {
    title: "Tus datos",
    faqs: [
      {
        question: "¿Quién puede ver la información de mi negocio?",
        answer:
          "Sólo las personas de tu equipo que vos das de alta, cada una con su usuario y contraseña. Cada negocio ve únicamente sus propios datos, y los vendedores no pueden gestionar el equipo.",
      },
    ],
  },
];

export const allFaqs: Faq[] = faqCategories.flatMap((c) => c.faqs);

// Las que se muestran en la landing, en este orden.
const featuredQuestions = [
  "¿Pesito es gratis?",
  "¿Qué diferencia hay entre los planes?",
  "¿Necesito instalar algo?",
  "¿Puedo usar lector de código de barras?",
  "¿Puedo subir los precios de todos los productos de una vez?",
  "¿Qué pasa si un cliente me debe (fiado)?",
  "¿Sirve si tengo varias sucursales?",
  "¿Imprime tickets? ¿Hace factura electrónica?",
];

export const featuredFaqs: Faq[] = featuredQuestions.map(
  (q) => allFaqs.find((f) => f.question === q)!
);
