import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const comprobantesDocs: DocArticle[] = [
  {
    slug: "como-conectar-una-impresora-termica",
    title: "Cómo conectar una impresora térmica",
    category: "comprobantes",
    summary: "Conectá tu impresora de tickets de 58 u 80 mm para que el ticket salga solo al cobrar. Función en prueba.",
    plan: null,
    where: "**Ajustes → Negocio → Impresora**",
    before: [
      "Usar Chrome o Edge en la computadora: otros navegadores no permiten conectar impresoras.",
      "Tener la impresora prendida, con papel y conectada (USB, puerto serie o Bluetooth).",
    ],
    intro: [
      "Con una impresora térmica de tickets conectada, el ticket sale solo al terminar cada venta, sin diálogo de impresión. Es una función en prueba.",
    ],
    steps: [
      { text: "Entrá a **Ajustes** y buscá **Conectá tu impresora**.", images: [{ name: "impresora-conectar", alt: "Ajustes de impresora con las opciones de conexión: por cable USB o por puerto serie o Bluetooth emparejado" }] },
      { text: "Elegí cómo se conecta: **Por cable USB** o **Por puerto serie o Bluetooth emparejado**. Si tu navegador lo permite, también aparece **Por Bluetooth (BLE)**, para impresoras chicas de 58 mm que se usan con el celular." },
      { text: "Elegí tu impresora en la ventana que se abre." },
      { text: "Elegí el **Ancho del papel** (58 u 80 mm).", images: [{ name: "impresora-ancho", alt: "Ajustes de impresora con el ancho del papel resaltado, y los interruptores de imprimir al cobrar, cortar el papel y abrir el cajón" }] },
      { text: "Tocá **Imprimir una prueba** y fijate que se vean bien los acentos y que corte el papel." },
      { text: "Activá **Imprimir al cobrar** para que el ticket salga solo al terminar cada venta." },
    ],
    tips: [
      "Es una función en prueba: si algo no sale bien, escribinos desde **Ayuda**.",
      "Si salen símbolos raros, apagá **Acentos y ñ**. Si sale basura en puerto serie, probá la **Velocidad del puerto** 115200.",
      "Si tu impresora tiene cortador o cajón, podés activar **Cortar el papel** y **Abrir el cajón de dinero**.",
      "Sin impresora térmica, el ticket se imprime con el diálogo de impresión del navegador.",
    ],
    faq: [
      { q: "¿Con qué navegador funciona?", a: "Con Chrome o Edge en la computadora. Los otros navegadores no permiten conectar impresoras." },
      { q: "¿Qué tipos de conexión soporta?", a: "**Por cable USB**, **Por puerto serie o Bluetooth emparejado** y **Por Bluetooth (BLE)**, para impresoras de 58 y 80 mm." },
      { q: "¿Qué hago si salen símbolos raros?", a: "Apagá **Acentos y ñ**. En puerto serie, probá cambiar la **Velocidad del puerto** (casi todas usan 9600; si sale basura, probá 115200)." },
      { q: "¿Y si se desconecta?", a: "Aparece **Volvé a conectarla (se desconectó)**: tocalo y elegí la impresora de nuevo." },
    ],
    keywords: ["impresora termica", "ticket", "imprimir", "58mm", "80mm", "usb", "bluetooth", "cajon de dinero", "cortar papel", "impresora"],
    related: ["como-imprimir-el-ticket-de-una-venta"],
    connections: [
      { slug: "como-personalizar-el-ticket", text: "Qué muestra el ticket se elige en **Ajustes**." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-configurar-la-facturacion-electronica-con-arca",
    title: "Cómo configurar la factura electrónica con ARCA",
    category: "comprobantes",
    summary: "Conectá tu CUIT y tu punto de venta de ARCA con Pesito, con un asistente paso a paso, y prendé la facturación.",
    plan: "basico",
    where: "**Ajustes → Facturación**",
    intro: [
      "Pesito emite la factura electrónica con los datos de tu propio negocio: tu CUIT, tu punto de venta y tu certificado de ARCA. Esta guía te muestra el recorrido; dentro de Pesito, un asistente te dice qué tocar en cada paso de la página de ARCA.",
      "Por ahora se emite Factura C (para monotributistas y exentos). La Factura A y B, para responsables inscriptos, todavía no están disponibles.",
    ],
    before: [
      "Ser dueño o administrador.",
      "Tener tu CUIT y tu clave fiscal de ARCA a mano.",
      "Ser monotributista o IVA exento.",
    ],
    steps: [
      { text: "Entrá a **Ajustes → Facturación**." },
      { text: "En **1. Datos del negocio** cargá tu razón social o nombre, tu condición frente al IVA (**Monotributista (Factura C)** o **IVA exento (Factura C)**) y tu domicilio comercial. El inicio de actividades y los Ingresos Brutos son opcionales. Guardá: aparece **Datos guardados.**" },
      { text: "En **2. Conectar con ARCA**, seguí el asistente, un paso por vez. Primero, en ARCA con tu clave fiscal, creá tu punto de venta (**Alta de Punto de Venta**, sistema de factura electrónica por web services) y anotá su número." },
      { text: "Volvé a Pesito, escribí tu CUIT y el número de punto de venta, y tocá **Generar solicitud**. Descargá el archivo .csr (**Descargar archivo .csr**) o usá **Copiar solicitud**." },
      { text: "En ARCA, entrá a la autogestión de certificados (WSASS), agregá un alias con la solicitud y bajá el certificado .crt que te devuelve." },
      { text: "Subí ese archivo .crt a Pesito (arrastralo o tocá para elegirlo). Aparece **Certificado guardado.**" },
      { text: "Por último, en ARCA autorizá tu alias al servicio de facturación electrónica (**Crear autorización a servicio**, servicio **wsfe**) con tu CUIT." },
      { text: "En **3. Probar la conexión**, tocá **Probar la conexión**. Si todo está bien, ves **¡Conexión con ARCA lista!**." },
      { text: "En **4. Prender o apagar la facturación**, prendela. Recién ahí Pesito empieza a poder emitir facturas." },
      { text: "En **Facturación automática por medio de pago**, elegí para cada medio de pago si la factura sale sola al cobrar (**Automática**) o si la hacés vos con el botón **Facturar** (**Manual**). Al principio todo está en Manual." },
    ],
    tips: [
      "El CUIT que escribís en Pesito, el de tu clave fiscal y el del alias de ARCA tienen que ser el mismo.",
      "Si ves **Modo de pruebas**, los comprobantes no tienen validez fiscal: sirven para probar que todo funciona.",
      "Podés apagar la facturación cuando quieras: no se factura nada hasta que la prendas.",
    ],
    faq: [
      { q: "¿Pesito incluye las facturas en el plan?", a: "No. El plan Básico o superior habilita la función, pero las facturas se contratan con un paquete mensual (de 500 a 10.000 facturas), que elegís al contratar el plan y se renueva junto con él. Las notas de crédito cuentan como una factura." },
      { q: "¿Qué pasa si se me terminan las facturas del mes?", a: "Podés seguir vendiendo: la venta sale como comprobante X (no fiscal) y ves el aviso **Sin facturas disponibles este mes**." },
      { q: "¿Puedo emitir Factura A o B?", a: "Todavía no: hoy se emite Factura C para monotributistas y exentos. Factura A y B (responsables inscriptos) llegan más adelante." },
      { q: "¿Qué hago si el asistente me marca un error en ARCA?", a: "Revisá que el CUIT sea el mismo en los tres lugares, que el punto de venta esté habilitado para factura electrónica por web services y que hayas autorizado el alias al servicio **wsfe**. Si sigue fallando, escribinos desde **Ayuda** con el mensaje que te muestra." },
    ],
    glossary: ["factura-c", "cae"],
    keywords: ["factura electronica", "arca", "afip", "factura c", "monotributo", "certificado", "punto de venta", "cuit", "wsfe", "facturar", "configurar facturacion"],
    connections: [
      { slug: "como-facturar-una-venta", text: "Una vez prendida la facturación, así se factura cada venta." },
      { slug: "como-elegir-o-cambiar-de-plan", text: "La facturación electrónica es del Plan Básico en adelante." },
    ],
    related: ["como-facturar-una-venta"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-facturar-una-venta",
    title: "Cómo facturar una venta con factura electrónica",
    category: "comprobantes",
    summary: "Emití la factura electrónica de una venta al cobrar o después, en ticket de 80 mm o en hoja A4, con CAE y código QR.",
    plan: "basico",
    where: "**Punto de Venta → ¡Venta cobrada! → Facturar**",
    intro: [
      "Cuando la facturación con ARCA está prendida, cada venta se puede facturar: automáticamente al cobrar (según el medio de pago) o a mano con el botón **Facturar**. La venta se cobra primero y la factura se pide a ARCA después, así que si ARCA falla la venta no se pierde.",
    ],
    before: ["Tener configurada y prendida la facturación con ARCA (guía de configuración)."],
    steps: [
      { text: "Cobrá la venta como siempre en el **Punto de Venta**." },
      { text: "Si ese medio de pago está en **Automática**, Pesito muestra **Facturando en ARCA…** y después **Factura electrónica emitida**." },
      { text: "Si está en **Manual**, en la ventana **¡Venta cobrada!** ves **Esta venta no se factura sola.**: tocá **Facturar** (o apretá **F**)." },
      { text: "Elegí cómo imprimirla: **Factura en ticket 80 mm** (tecla **F**) o **Factura en hoja A4** (tecla **A**)." },
      { text: "Si te olvidaste de facturar una venta, buscala en **Reportes → Ventas**, abrila con **Ver detalle** y tocá **Facturar esta venta**." },
    ],
    tips: [
      "Si ARCA no responde, la venta queda cobrada: tocá **Reintentar** o facturala después desde **Ventas**. Pesito no duplica la factura de una misma venta.",
      "La factura trae el CAE y el código QR de ARCA.",
      "Para anular una venta ya facturada usá **Anular con nota de crédito** en el detalle de la venta.",
    ],
    faq: [
      { q: "¿Se puede facturar una venta que ya cobré ayer?", a: "Sí, mientras no esté anulada ni tenga ya una factura: abrí la venta en **Reportes → Ventas** y tocá **Facturar esta venta**." },
      { q: "¿Qué diferencia hay entre el ticket no fiscal y la factura?", a: "El ticket (**Imprimir ticket (no fiscal)**) es un comprobante interno sin validez fiscal. La factura electrónica la autoriza ARCA y trae CAE y código QR." },
      { q: "¿Cómo anulo una venta facturada?", a: "No se anula a secas: abrí la venta y tocá **Anular con nota de crédito**. La nota de crédito cuenta como una factura de tu paquete mensual." },
      { q: "¿Qué pasa si no me quedan facturas en el mes?", a: "La venta se cobra igual y sale como comprobante X (no fiscal). Verás **Sin facturas disponibles este mes**: podés facturarla después, cuando tengas cupo." },
    ],
    glossary: ["cae", "factura-c", "factura-a", "factura-b", "nota-de-credito"],
    keywords: ["facturar", "factura electronica", "factura c", "cae", "qr", "ticket 80 mm", "factura a4", "comprobante", "nota de credito", "arca"],
    connections: [
      { slug: "como-configurar-la-facturacion-electronica-con-arca", text: "Antes hay que conectar tu CUIT y tu punto de venta con ARCA." },
      { slug: "como-anular-una-venta", text: "Una venta facturada se anula con nota de crédito." },
      { slug: "como-imprimir-el-ticket-de-una-venta", text: "El ticket no fiscal sigue disponible para todas las ventas." },
    ],
    related: ["como-configurar-la-facturacion-electronica-con-arca", "como-imprimir-el-ticket-de-una-venta"],
    updatedAt: UPDATED,
  },
];
