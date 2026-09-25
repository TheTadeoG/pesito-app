export interface BlogSection {
  heading?: string;
  paragraphs: string[];
  list?: string[];
}

// Autor de los artículos. Si algún día escribe otra persona, se agrega un
// campo author por post que pise a éste.
export const blogAuthor = { name: "Tadeo", role: "de Pesito" };

export interface BlogPost {
  slug: string;
  title: string;
  /** Título corto para Google (≤51 caracteres + " | Pesito"). Si falta, se usa title. */
  seoTitle?: string;
  excerpt: string;
  publishedAt: string;
  readingMinutes: number;
  sections: BlogSection[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "como-armar-lista-de-precios",
    seoTitle: "Cómo armar una lista de precios",
    title: "Cómo armar una lista de precios sin perder plata en el camino",
    excerpt:
      "El método simple para ponerle precio a cada producto sin adivinar — y sin regalar margen sin darte cuenta.",
    publishedAt: "2026-08-04",
    readingMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Poner precio \"a ojo\" es de las formas más comunes de perder pesitos en un comercio chico, y casi nunca se nota en el momento — se nota a fin de mes, cuando la caja no da lo que debería dar. Armar bien la lista de precios no es complicado, pero sí hay que hacerlo con un método, no con el primer número que suena bien.",
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
    seoTitle: "Arqueo de caja: qué es y cómo se hace",
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
    seoTitle: "Factura A, B o C: la diferencia explicada",
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
    seoTitle: "Cómo elegir un sistema para tu negocio",
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
          "Porque construimos Pesito pensando exactamente en esas preguntas: plan gratis sin vencimiento, fiado como función central, venta por peso o por unidad, y soporte por WhatsApp con una persona real. No pretendemos ser la única opción — sí que, si las evaluás con esta lista, tengamos con qué responder cada una.",
        ],
      },
    ],
  },
  {
    slug: "como-controlar-el-fiado",
    seoTitle: "Cómo controlar el fiado de tus clientes",
    title: "Cómo controlar el fiado de tus clientes sin perder plata",
    excerpt:
      "El fiado fideliza, pero anotado en un cuaderno se pierde. Cómo llevarlo ordenado, cobrarlo a tiempo y saber siempre quién te debe.",
    publishedAt: "2026-09-01",
    readingMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Fiar es parte del negocio de todos los días: el vecino que viene siempre, la familia que paga a fin de mes. El problema no es fiar, es no saber exactamente cuánto te deben, quién y desde cuándo. Un cuaderno se moja, se pierde o tiene una cuenta mal sumada, y esa plata no vuelve.",
        ],
      },
      {
        heading: "Las reglas que conviene tener claras",
        paragraphs: [
          "Antes de pensar en herramientas, definí tus propias reglas. Ayudan a que el fiado no se te vaya de las manos:",
        ],
        list: [
          "A quién le fiás: clientes que conocés y que vienen seguido.",
          "Hasta cuánto: un tope por cliente evita deudas que después no se pueden pagar.",
          "Cada cuánto se paga: semanal, quincenal o a fin de mes, pero siempre claro.",
          "Qué pasa si se atrasa: avisar a tiempo es mucho más fácil que reclamar meses después.",
        ],
      },
      {
        heading: "Anotá cada venta fiada en el momento",
        paragraphs: [
          "El error más común es anotar \"después\". En un día con mucha gente, ese después no llega. Cada venta fiada tiene que quedar registrada en el mismo momento en que se cobra, con el nombre del cliente y el detalle de lo que se llevó, así si hay una duda la podés resolver mirando la venta.",
        ],
      },
      {
        heading: "Mirá quién te debe y hace cuánto",
        paragraphs: [
          "No alcanza con saber el total. Lo que sirve es ver quién te debe más y quién hace más tiempo que no te paga: son los primeros a los que conviene llamar. Una deuda de hace dos semanas se cobra; una de hace tres meses, muchas veces no.",
        ],
      },
      {
        heading: "Cómo lo resolvés con Pesito",
        paragraphs: [
          "En Pesito el fiado es una forma de cobro más, como el efectivo o la transferencia. Está incluido en el Plan Gratis:",
        ],
        list: [
          "Al cobrar, elegís \"Fiado\" y el cliente: la venta queda cargada a su cuenta corriente.",
          "También podés cobrar una parte en efectivo y el resto fiado (pago mixto).",
          "Cuando el cliente paga, registrás el pago total o parcial y el saldo se actualiza solo.",
          "En Reportes ves \"Quién te debe\": cada cliente con su deuda y hace cuántos días no paga.",
          "En la ficha de cada cliente tenés todas sus compras y pagos, por si hay que revisar algo.",
        ],
      },
    ],
  },
  {
    slug: "como-controlar-el-stock",
    seoTitle: "Cómo controlar el stock de tu negocio",
    title: "Cómo controlar el stock de tu negocio y no quedarte sin mercadería",
    excerpt:
      "Quedarte sin lo que más se vende es plata que perdés. Cómo saber qué tenés, qué se está acabando y qué te falta pedir.",
    publishedAt: "2026-09-08",
    readingMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Hay dos formas de perder plata con el stock: quedarte sin lo que la gente viene a buscar, o llenarte de mercadería que no rota. Las dos se evitan con lo mismo: saber en todo momento qué tenés y cuánto se vende.",
        ],
      },
      {
        heading: "Que el stock se mueva solo con cada venta y cada compra",
        paragraphs: [
          "Contar todo a mano cada semana no es sostenible. Lo que funciona es que cada venta descuente lo vendido y cada compra sume lo que entró, sin que tengas que hacer nada extra. Así, el número que ves es el real y los conteos a mano quedan sólo para controlar de vez en cuando.",
        ],
      },
      {
        heading: "Ponele un stock mínimo a lo importante",
        paragraphs: [
          "El stock mínimo es la cantidad por debajo de la cual tenés que reponer. No hace falta ponérselo a todo: empezá por lo que más se vende y lo que tarda más en llegar. Con eso, en vez de descubrir el faltante cuando un cliente te lo pide, lo ves venir.",
        ],
      },
      {
        heading: "Registrá las roturas, vencidos y diferencias",
        paragraphs: [
          "Un paquete roto o un producto vencido también es stock que sale. Si no lo registrás, el sistema cree que lo tenés y los números dejan de coincidir con la góndola. Anotalo con el motivo: al mes vas a ver si hay un producto que siempre se rompe o se vence, y eso también es información.",
        ],
      },
      {
        heading: "Cómo lo resolvés con Pesito",
        paragraphs: ["En todos los planes, cada venta descuenta el stock y cada compra lo suma, sin pasos extra. Desde el Plan Esencial sumás el control de stock:"],
        list: [
          "Le ponés un stock mínimo a cada producto y Pesito te muestra los que están por acabarse, con un botón para cargar la compra.",
          "Los ajustes a mano (rotura, vencido, conteo) se registran con el motivo, y el historial de movimientos muestra cada entrada y salida.",
          "Ves el stock valorizado: cuánta plata tenés parada en mercadería, al costo y al precio de venta.",
          "Productos por unidad o por peso, con la cantidad exacta en kilos (en todos los planes).",
          "Si tenés varias sucursales (Plan IA), cada una lleva su propio stock y podés pasar mercadería de una a otra.",
        ],
      },
    ],
  },
  {
    slug: "como-actualizar-precios-con-inflacion",
    seoTitle: "Cómo actualizar precios con la inflación",
    title: "Cómo actualizar precios con la inflación sin perder margen",
    excerpt:
      "Cuando los proveedores aumentan seguido, actualizar producto por producto no da abasto. Cómo hacerlo rápido y sin equivocarte.",
    publishedAt: "2026-09-15",
    readingMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Con aumentos frecuentes, el mayor riesgo no es subir los precios: es subirlos tarde. Cada día que vendés con el precio viejo y reponés con el costo nuevo, estás perdiendo margen sin darte cuenta.",
        ],
      },
      {
        heading: "Actualizá por proveedor o por marca, no producto por producto",
        paragraphs: [
          "Los aumentos casi siempre llegan por proveedor (\"subió todo lo de la distribuidora un 8%\") o por marca. Actualizar cien productos de a uno lleva horas y es fácil saltearse alguno. Lo práctico es aplicar el porcentaje a todo el grupo de una sola vez.",
        ],
      },
      {
        heading: "Mirá el costo, no sólo el precio",
        paragraphs: [
          "Si aumentó el costo y subís el precio en el mismo porcentaje, mantenés el margen. Si subís el precio \"redondo\" sin mirar el costo, podés quedar ganando menos que antes. Por eso conviene cargar el costo nuevo cuando llega la mercadería y decidir el precio a partir de ahí.",
        ],
      },
      {
        heading: "Guardá el historial",
        paragraphs: [
          "Saber cuándo y cuánto subió cada producto te sirve para comparar proveedores, explicarle a un cliente un aumento y detectar errores (un precio que quedó mal cargado se nota enseguida si ves el historial).",
        ],
      },
      {
        heading: "Cómo lo resolvés con Pesito",
        paragraphs: ["Los aumentos masivos están en el Plan Pro (y los probás gratis los primeros 14 días):"],
        list: [
          "Aumentos masivos: elegís un proveedor o una marca, ponés el porcentaje y se actualizan todos sus productos de una vez.",
          "Podés aumentar el costo y que el precio de venta suba en la misma proporción, para no perder margen.",
          "Si te equivocaste, deshacés el aumento.",
          "En todos los planes, cada producto guarda su historial de precios y de costos.",
          "Al registrar una compra con el costo nuevo, podés actualizar ahí mismo el precio de venta.",
        ],
      },
    ],
  },
  {
    slug: "como-controlar-la-caja-con-empleados",
    title: "Cómo controlar la caja cuando tenés empleados",
    excerpt:
      "Si la caja no cierra, ¿quién fue? Cómo organizar las cajas por persona para detectar diferencias y confiar en los números.",
    publishedAt: "2026-09-22",
    readingMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Cuando atiende una sola persona, la caja se controla fácil. Cuando son dos o tres por turno y todos usan el mismo cajón, una diferencia al final del día es imposible de explicar: nadie sabe de dónde salió.",
        ],
      },
      {
        heading: "Una caja por persona",
        paragraphs: [
          "La regla más útil es que cada empleado abra su propia caja con un monto inicial contado, cobre en ella durante su turno y la cierre contando el efectivo. Así, si hay una diferencia, sabés en qué caja y en qué turno pasó.",
        ],
      },
      {
        heading: "Registrá todo lo que entra y sale que no es una venta",
        paragraphs: [
          "Un retiro para pagar un flete, un ingreso de cambio, el pago de una deuda de un cliente: si no se anota, al cierre parece un faltante o un sobrante que no lo es. Todo movimiento de efectivo tiene que quedar registrado con su motivo.",
        ],
      },
      {
        heading: "Mirá las diferencias por persona, no sólo del día",
        paragraphs: [
          "Una diferencia de $500 un día puede ser un error de vuelto. La misma diferencia repetida en la caja de la misma persona es otra cosa. Ver los faltantes y sobrantes acumulados por empleado te muestra si hay un patrón.",
        ],
      },
      {
        heading: "Cómo lo resolvés con Pesito",
        paragraphs: ["Cada usuario tiene su caja en todos los planes (1 en el Plan Gratis, hasta 2 en el Esencial y hasta 6 en el Pro):"],
        list: [
          "Cada usuario abre y cierra su caja con su monto inicial.",
          "Retiros e ingresos de efectivo se registran con su motivo, y los cobros de fiado y pagos a proveedores en efectivo también impactan en la caja.",
          "Al cerrar contás el efectivo (hay una calculadora de billetes) y Pesito te dice si hubo faltante o sobrante.",
          "Podés configurar una hora de cierre y el sistema le recuerda a cada uno que cierre su caja.",
          "Desde el Plan Esencial, en Reportes ves las diferencias de caja por persona, y con el Plan Pro, desde En vivo ves en el momento quién tiene la caja abierta, cuánto efectivo tiene y cuánto vendió.",
          "Tus empleados no necesitan email: les creás un usuario y contraseña desde Pesito.",
        ],
      },
    ],
  },
  {
    slug: "como-manejar-varias-sucursales",
    seoTitle: "Cómo manejar varias sucursales",
    title: "Cómo manejar varias sucursales desde un solo sistema",
    excerpt:
      "Abrir un segundo local multiplica el trabajo. Cómo llevar el stock, las cajas y las ventas de cada sucursal sin volverte loco.",
    publishedAt: "2026-09-25",
    readingMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Con un segundo local aparecen preguntas nuevas: ¿cuánto tengo de cada cosa en cada lugar?, ¿cuál vende más?, ¿mando mercadería de uno al otro?, ¿cómo sé qué pasa en el que no estoy? Llevarlo en planillas separadas funciona un tiempo, hasta que los números dejan de coincidir.",
        ],
      },
      {
        heading: "Cada sucursal con su propio stock",
        paragraphs: [
          "Lo primero es que el stock sea por local. Que el sistema diga \"hay 20\" no sirve si los 20 están en la otra sucursal. Cada venta tiene que descontar del local donde se vendió, y cada compra sumar donde entró la mercadería.",
        ],
      },
      {
        heading: "Pasar mercadería de un local al otro",
        paragraphs: [
          "Es muy común reponer una sucursal con lo que sobra en otra. Si eso no se registra, un local termina con stock \"de más\" y el otro \"de menos\" en el sistema. Cada transferencia tiene que restar en el origen y sumar en el destino.",
        ],
      },
      {
        heading: "Ver todo junto, y cada local por separado",
        paragraphs: [
          "Como dueño necesitás las dos vistas: el total del negocio y el detalle de cada sucursal con sus vendedores. Así detectás rápido si un local viene flojo hoy o si una caja está abierta hace demasiado.",
        ],
      },
      {
        heading: "Cómo lo resolvés con Pesito",
        paragraphs: ["Las sucursales están en el Plan IA, que incluye hasta 2 (si tenés más, escribinos):"],
        list: [
          "Cada sucursal tiene su propio stock y sus cajas; vender descuenta del local de la caja.",
          "A cada vendedor le asignás su sucursal; vos cambiás de sucursal desde el menú.",
          "Transferencias de mercadería entre sucursales, con el registro en el historial de cada una.",
          "La pantalla En vivo muestra primero el negocio, después cada sucursal y adentro cada vendedor con su caja, actualizada cada 30 segundos.",
          "Si recién empezás, arrancá con una sucursal en el Plan Gratis y sumá las demás cuando las necesites.",
        ],
      },
    ],
  },
  {
    slug: "como-saber-cuanto-ganas",
    title: "Cómo saber cuánto ganás de verdad en tu negocio",
    excerpt:
      "Vender mucho no es lo mismo que ganar. Qué números mirar para saber si el negocio anda bien y dónde está la plata.",
    publishedAt: "2026-09-25",
    readingMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Es muy común mirar sólo cuánto entró en la caja. Pero un día con mucha venta de productos con poco margen puede dejarte menos que un día tranquilo. Para saber cómo anda el negocio hay que mirar la ganancia, no sólo la venta.",
        ],
      },
      {
        heading: "Cargá el costo de cada producto",
        paragraphs: [
          "Sin el costo no hay forma de saber la ganancia. No hace falta que sea perfecto desde el primer día: empezá por lo que más vendés y actualizalo cuando llega una compra.",
        ],
      },
      {
        heading: "Los números que conviene mirar",
        paragraphs: ["Con pocos indicadores alcanza para saber cómo venís:"],
        list: [
          "Ganancia estimada: lo vendido menos lo que te costó.",
          "Ticket promedio: cuánto gasta cada cliente por compra. Subirlo un poco (una oferta en la caja, un producto complementario) suele ser más fácil que conseguir clientes nuevos.",
          "Productos más vendidos y los que más ganancia dejan: no siempre son los mismos, y los segundos son los que no te pueden faltar.",
          "Productos vendidos a pérdida: un precio desactualizado puede hacerte vender por debajo del costo sin darte cuenta.",
          "Cómo te pagan: cuánto es efectivo, transferencia, tarjeta o fiado.",
        ],
      },
      {
        heading: "Cómo lo resolvés con Pesito",
        paragraphs: [
          "En todos los planes, Reportes te muestra lo vendido, el ticket promedio, las ventas por día, los medios de pago y los productos más vendidos. Desde el Plan Esencial ves las ventas de cada vendedor. Con el Plan Pro sumás los reportes avanzados: la ganancia estimada, los productos que más ganancia dejan, los que se están vendiendo a pérdida y la comparación con el período anterior.",
        ],
      },
    ],
  },
];
