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
    steps: [
      { text: "Entrá a **Clientes** y tocá **Nuevo cliente**." },
      { text: "Escribí el nombre. Si querés, sumá **Teléfono**, **Email**, **Domicilio** y **Notas** (por ejemplo, “Paga los viernes”)." },
      { text: "Si necesitás sus datos fiscales, cargá el **Documento** (DNI, CUIT o CUIL) y la **Condición frente al IVA**." },
      { text: "Tocá **Crear cliente**." },
    ],
    tips: [
      "En el Punto de Venta también podés elegir un cliente al cobrar; sólo se pide uno cuando la venta es fiado.",
      "Con el teléfono cargado podés recordarle la deuda por WhatsApp.",
      "Para cargar muchos de una vez, usá **Acciones → Cargar desde Excel** (Plan Básico).",
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
    steps: [
      { text: "Entrá a **Clientes** y buscá al cliente. Podés filtrar con **Con deuda** o por antigüedad de la deuda." },
      { text: "Tocá al cliente para abrir su ficha, donde ves la **Cuenta corriente** y el **Historial de compras**." },
      { text: "Tocá **Registrar pago** y escribí cuánto te paga." },
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
    steps: [
      { text: "Entrá a **Clientes**." },
      { text: "Tocá **Acciones** y elegí **Descargar Excel**. Elegí qué querés bajar." },
      { text: "Abrí el archivo descargado con Excel o con Google Sheets." },
    ],
    tips: ["La descarga está en todos los planes; la carga masiva de clientes desde planilla es del Plan Básico."],
    keywords: ["excel clientes", "exportar clientes", "descargar clientes", "estado de cuenta", "deudas a excel", "lista de clientes"],
    related: ["como-cobrar-la-deuda-de-un-cliente", "como-cargar-un-cliente"],
    updatedAt: UPDATED,
  },
];
