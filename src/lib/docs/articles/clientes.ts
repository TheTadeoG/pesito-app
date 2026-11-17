import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const clientesDocs: DocArticle[] = [
  {
    slug: "como-cargar-un-cliente",
    title: "Cómo cargar un cliente",
    category: "clientes",
    summary: "Sumá un cliente con sus datos para venderle fiado, llevar su cuenta y ver cuánto te compra.",
    plan: null,
    where: "**Clientes → Nuevo cliente**",
    intro: [
      "Cargar un cliente te permite venderle fiado, llevar su cuenta y ver cuánto te compra. No hace falta cargar a todos: para ventas comunes alcanza con **Consumidor Final**.",
    ],
    steps: [
      { text: "Entrá a **Clientes** y tocá **Nuevo cliente**.", images: [{ name: "clientes-nuevo", alt: "Lista de Clientes con el botón Nuevo cliente resaltado" }] },
      { text: "Escribí el nombre. Si querés, sumá **Teléfono**, **Email**, **Domicilio** y **Notas** (por ejemplo, “Paga los viernes”)." },
      { text: "Si necesitás sus datos fiscales, cargá el **Documento** (DNI, CUIT o CUIL) y la **Condición frente al IVA**." },
      { text: "Tocá **Crear cliente**." },
    ],
    tips: [
      "En el Punto de Venta también podés elegir un cliente al cobrar; sólo se pide uno cuando la venta es fiado.",
      "Con el teléfono cargado podés recordarle la deuda por WhatsApp.",
      "Para cargar muchos de una vez, usá **Acciones → Cargar desde Excel** (Plan Básico).",
    ],
    faq: [
      { q: "¿Qué datos son obligatorios?", a: "Sólo el nombre. Teléfono, email, domicilio y notas son opcionales. Con el teléfono podés recordarle la deuda por WhatsApp." },
      { q: "¿Qué es el comprobante que necesita?", a: "Es el tipo de comprobante que le corresponde a ese cliente: **Sin factura (Comprobante X)**, el ticket interno de siempre, o una factura. Si le cargás su documento y su condición frente al IVA, Pesito los usa al facturar con ARCA (función del Plan Básico)." },
      { q: "¿Puedo cargar el cliente al vender?", a: "Sí: en el Punto de Venta, **Cargar cliente nuevo** lo crea con el nombre y después completás el resto en **Clientes**." },
      { q: "¿Cómo busco a un cliente?", a: "En el buscador de **Clientes** por nombre, teléfono o documento." },
    ],
    keywords: ["cliente", "nuevo cliente", "cargar cliente", "alta de cliente", "agregar cliente", "datos del cliente", "excel clientes", "carga masiva"],
    related: ["como-vender-fiado", "como-cobrar-la-deuda-de-un-cliente"],
    connections: [
      { slug: "como-vender-fiado", text: "Los clientes se usan para vender fiado." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-cobrar-la-deuda-de-un-cliente",
    title: "Cómo cobrar la deuda de un cliente",
    category: "clientes",
    summary: "Registrá un pago de un cliente que te debe del fiado, total o parcial, y mirá su saldo actualizado.",
    plan: null,
    where: "**Clientes → cliente con deuda → Registrar pago**",
    intro: [
      "Cuando un cliente te paga lo que te debe del fiado, registrás el pago para que su deuda baje y, si fue en efectivo, entre a tu caja.",
    ],
    steps: [
      { text: "Entrá a **Clientes** y buscá al cliente. Podés filtrar con **Con deuda** o por antigüedad de la deuda.", images: [{ name: "clientes-recordar", alt: "Lista de Clientes con el botón de recordar la deuda por WhatsApp resaltado" }] },
      { text: "Tocá al cliente para abrir su ficha, donde ves la **Cuenta corriente** y el **Historial de compras**." },
      { text: "Tocá **Registrar pago** y escribí cuánto te paga.", images: [{ name: "clientes-pago", alt: "Ventana Registrar pago de un cliente con el monto resaltado" }] },
      { text: "Elegí el medio (**Efectivo**, **Transferencia** o **Tarjeta**)." },
      {
        text: "Tocá **Registrar pago**.",
        note: "En efectivo, si te da de más, el sistema te calcula el **Vuelto**.",
      },
    ],
    tips: [
      "Puede pagar menos que el total: el resto queda como deuda.",
      "Si el pago es en efectivo, tenés que tener la caja abierta.",
      "Desde la lista podés tocar **Recordarle la deuda por WhatsApp**.",
      "Arriba de la lista ves **Te deben en total**.",
    ],
    faq: [
      { q: "¿Puede pagar menos del total?", a: "Sí. El pago puede ser parcial: lo que falta sigue como deuda. La ventana muestra **Falta** hasta que coincida." },
      { q: "¿Por qué no me deja cobrar en efectivo?", a: "Hace falta la caja abierta: el dinero entra a tu caja y se muestra como **Cobros de fiado**. Abrila desde **Caja**." },
      { q: "¿Cómo veo quién me debe más tiempo?", a: "En **Clientes**, con los filtros por antigüedad (**Hasta 7 días**, **De 8 a 30 días**, **Más de 30 días**) y el orden **Los que deben hace más, primero**." },
      { q: "¿Puedo recordarle la deuda?", a: "Sí: en la lista, **Recordarle la deuda por WhatsApp** abre el mensaje listo para enviar si el cliente tiene teléfono cargado." },
    ],
    glossary: ["fiado"],
    keywords: ["cobrar deuda", "fiado", "pago de cliente", "cuenta corriente", "saldo", "registrar pago", "deudores", "cobrar fiado", "recordar deuda"],
    related: ["como-vender-fiado", "como-descargar-el-estado-de-cuenta-de-un-cliente"],
    connections: [
      { slug: "como-abrir-la-caja", text: "Si te paga en efectivo, la caja tiene que estar abierta." },
      { slug: "como-vender-fiado", text: "La deuda viene de las ventas fiadas." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-descargar-el-estado-de-cuenta-de-un-cliente",
    title: "Cómo descargar los clientes y sus deudas a Excel",
    category: "clientes",
    summary: "Llevate la lista de clientes con lo que debe cada uno en una planilla de Excel.",
    plan: null,
    where: "**Clientes → Acciones → Descargar Excel**",
    before: ["Ser dueño o administrador."],
    intro: [
      "Descargás tus clientes en una planilla con su código, datos de contacto, saldo y fechas, o sólo la lista de deudores con cuánto debe cada uno y desde cuándo.",
    ],
    steps: [
      { text: "Entrá a **Clientes**." },
      { text: "Tocá **Acciones** y elegí **Descargar Excel**. Elegí qué querés bajar.", images: [{ name: "clientes-descargar", alt: "Menú Acciones de Clientes con Descargar Excel resaltado" }] },
      { text: "Abrí el archivo descargado con Excel o con Google Sheets." },
    ],
    tips: ["La descarga está en todos los planes; la carga masiva de clientes desde planilla es del Plan Básico."],
    faq: [
      { q: "¿Qué opciones de descarga hay?", a: "Elegís entre la lista de clientes completa o **La lista de deudores con cuánto debe cada uno y desde cuándo**, además de la **Planilla modelo (vacía)** para cargar clientes nuevos." },
      { q: "¿Quién puede descargarla?", a: "Sólo el dueño y los administradores. La descarga está en todos los planes; la carga masiva es del Plan Básico." },
    ],
    keywords: ["excel clientes", "exportar clientes", "descargar clientes", "estado de cuenta", "deudas a excel", "lista de clientes"],
    related: ["como-cobrar-la-deuda-de-un-cliente", "como-cargar-un-cliente"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-cargar-clientes-desde-excel",
    title: "Cómo cargar muchos clientes desde Excel",
    category: "clientes",
    summary: "Subí una planilla con tus clientes y cargalos todos juntos, sin tocar lo que cada uno te debe.",
    plan: "basico",
    where: "**Clientes → Acciones → Cargar desde Excel**",
    before: ["Ser dueño o administrador.", "Tener tus clientes en una planilla de Excel (.xlsx) o CSV."],
    steps: [
      { text: "Entrá a **Clientes**, tocá **Acciones** y elegí **Cargar desde Excel**.", images: [{ name: "clientes-excel", alt: "Menú Acciones de Clientes con Cargar desde Excel resaltado" }] },
      { text: "Descargá la **Planilla modelo (vacía)** y completala. Lo único obligatorio es el nombre; podés sumar razón social, teléfono, mail, documento, tipo de factura y notas." },
      { text: "Subí la planilla (o arrastrala) y revisá la vista previa: **Clientes nuevos**, **Ya existen** y **Con errores**." },
      { text: "Elegí qué hacer si un cliente ya existe (dejarlo como está o actualizar sus datos) y confirmá la carga." },
      { text: "No cierres la ventana hasta que diga **Carga terminada**." },
    ],
    tips: [
      "Lo que cada cliente debe (el saldo de fiado) nunca se modifica con la planilla: si trae una columna de saldo, se ignora.",
      "Los archivos .xls viejos no se pueden leer: guardalos como .xlsx o CSV.",
      "Con **Descargar Excel** podés bajar tus clientes con su saldo, editarlos y volver a subirlos.",
    ],
    faq: [
      { q: "¿Qué pasa si el cliente ya existe?", a: "En el paso de vista previa elegís qué hacer: dejar sus datos como están o actualizarlos con los de la planilla. Lo que cada cliente debe no se modifica en ningún caso." },
    ],
    keywords: ["clientes excel", "importar clientes", "carga masiva de clientes", "subir clientes", "planilla de clientes", "migrar clientes", "csv"],
    connections: [
      { slug: "como-vender-fiado", text: "El fiado sólo cambia vendiendo a fiado o registrando un cobro, no con la planilla." },
      { slug: "como-descargar-el-estado-de-cuenta-de-un-cliente", text: "La misma planilla que se baja se puede volver a subir." },
    ],
    related: ["como-cargar-un-cliente", "como-elegir-o-cambiar-de-plan"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-ver-la-ficha-de-un-cliente",
    title: "Cómo ver la ficha y el historial de un cliente",
    category: "clientes",
    summary: "Mirá cuánto te compró, su ticket promedio, su cuenta corriente y todas sus compras en un solo lugar.",
    plan: null,
    where: "**Clientes → tocá el cliente**",
    steps: [
      { text: "Entrá a **Clientes** y buscá al cliente (**Buscar por nombre, teléfono o documento…**)." },
      { text: "Tocalo (**Ver ficha del cliente**) para abrir su ficha." },
      { text: "Arriba ves **Total comprado**, **Ticket promedio**, **Última compra** y lo que te debe, si tiene deuda." },
      { text: "En **Cuenta corriente** ves las ventas fiadas y sus pagos; en **Historial de compras**, todo lo que compró." },
    ],
    tips: [
      "Desde la ficha registrás los pagos de su deuda con **Registrar pago**.",
      "Si el cliente no tiene datos de contacto, aparece **Sin datos de contacto**: editá el cliente para cargarlos.",
    ],
    faq: [
      { q: "¿Qué muestra la ficha de un cliente?", a: "Muestra **Total comprado**, **Ticket promedio**, **Última compra**, su **Cuenta corriente** (ventas fiadas y pagos) y el **Historial de compras**." },
      { q: "¿Cómo registro un pago desde la ficha?", a: "Con **Registrar pago**: funciona igual que desde la lista de clientes." },
    ],
    glossary: ["fiado"],
    keywords: ["ficha del cliente", "historial del cliente", "cuenta corriente del cliente", "cuanto me compro", "saldo del cliente", "datos del cliente", "ticket promedio"],
    connections: [
      { slug: "como-cobrar-la-deuda-de-un-cliente", text: "Desde la ficha registrás los pagos de su deuda." },
      { slug: "como-ver-el-historial-de-ventas", text: "Cada compra del cliente también está en el historial de ventas." },
    ],
    related: ["como-cargar-un-cliente"],
    updatedAt: UPDATED,
  },
];
