import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const cajaDocs: DocArticle[] = [
  {
    slug: "como-abrir-la-caja",
    title: "Cómo abrir la caja",
    category: "caja",
    summary: "Abrí tu caja con el efectivo con el que empezás el día: sin caja abierta no se puede cobrar.",
    plan: null,
    where: "**Caja → Abrir caja** (o **Abrir caja para vender** en el menú; atajo Alt + 2)",
    steps: [
      { text: "Entrá a **Caja** (menú, o **Alt + 2**) o tocá **Abrir caja para vender** en el bloque de arriba del menú." },
      { text: "En **Monto inicial (en efectivo)** escribí cuánta plata hay en el cajón al empezar. Si arrancás sin cambio, poné 0." },
      { text: "Tocá **Abrir caja** (o **Enter**). Aparece **¡Caja abierta!** con el monto inicial." },
      { text: "Ya podés vender desde **Punto de Venta**." },
    ],
    tips: [
      "Cada persona tiene su propia caja, independiente de las demás. Lo que vende cada uno suma a su caja.",
      "Si tu negocio tiene varias sucursales, la caja se abre en la sucursal en la que estás trabajando.",
    ],
    keywords: ["abrir caja", "empezar el dia", "monto inicial", "apertura", "caja cerrada", "no puedo vender", "iniciar turno"],
    related: ["como-cerrar-la-caja", "como-hacer-una-venta", "como-usar-mas-de-una-caja"],
    connections: [
      { slug: "como-hacer-una-venta", text: "Con la caja abierta ya podés cobrar en el **Punto de Venta**." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-ingresar-o-retirar-efectivo-de-la-caja",
    title: "Cómo ingresar o retirar efectivo de la caja",
    category: "caja",
    summary: "Registrá la plata que sumás al cajón (cambio, reposición) o que sacás (pago a un proveedor) para que el cierre cierre bien.",
    plan: null,
    where: "**Caja → Ingresar / Retirar**",
    before: ["Tener la caja abierta."],
    steps: [
      { text: "Entrá a **Caja** y tocá **Ingresar / Retirar**." },
      { text: "Elegí **Ingresar efectivo** (sumás plata al cajón, por ejemplo cambio) o **Retirar efectivo** (sacás plata, por ejemplo para pagarle a un proveedor)." },
      { text: "Escribí el **Monto** y, si querés, el **Motivo (opcional)**." },
      { text: "Confirmá con **Confirmar** (o **Enter**). Aparece **Ingreso registrado** o **Retiro registrado**." },
    ],
    tips: [
      "Todo lo que ingresás o retirás entra en la cuenta del **Monto esperado en caja** al cerrarla.",
      "Los movimientos del turno se ven en **Movimientos del turno**; tocá **Ver todos** para la lista completa.",
    ],
    keywords: ["ingresar efectivo", "retirar efectivo", "sacar plata", "poner plata", "cambio", "retiro", "ingreso", "movimiento de caja", "gastos"],
    related: ["como-cerrar-la-caja", "como-abrir-la-caja"],
    connections: [
      { slug: "como-cerrar-la-caja", text: "Los ingresos y retiros se tienen en cuenta en el cierre." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-cerrar-la-caja",
    title: "Cómo cerrar la caja y hacer el arqueo",
    category: "caja",
    summary: "Contá el efectivo, compará con lo que el sistema espera y cerrá el turno; el sistema registra el sobrante o faltante.",
    plan: null,
    where: "**Caja → Cerrar caja**",
    before: ["Contar todo el efectivo que hay en el cajón."],
    steps: [
      { text: "Entrá a **Caja** y tocá **Cerrar caja**." },
      {
        text: "Mirá el **Monto esperado en caja**: es lo que tendría que haber en el cajón.",
        note: "Se calcula así: lo que abriste, más ventas en efectivo, cobros de fiado e ingresos, menos retiros, pagos a proveedores y compras pagadas en efectivo.",
      },
      { text: "En **Monto real contado** escribí lo que contaste de verdad." },
      { text: "Si no coincide, el sistema te muestra la **Diferencia detectada**: **Sobrante de efectivo** o **Faltante de efectivo**." },
      { text: "Tocá **Cerrar Caja** (o **Enter**) para terminar el turno." },
    ],
    tips: [
      "Lo vendido a fiado no entra al cajón: el sistema lo marca como pendiente de cobro.",
      "El dueño ve las diferencias de cada persona en el historial de caja.",
      "En **Ajustes** podés configurar la hora de cierre para que el sistema te avise cuando pasó.",
    ],
    keywords: ["cerrar caja", "arqueo", "cierre", "faltante", "sobrante", "diferencia", "contar plata", "fin del dia", "cierre de turno"],
    related: ["como-ver-el-historial-de-cierres-de-caja", "como-ingresar-o-retirar-efectivo-de-la-caja"],
    connections: [
      { slug: "como-cobrar-en-efectivo-y-dar-vuelto", text: "El efectivo esperado sale de las ventas en efectivo del día." },
      { slug: "como-ver-lo-que-hizo-cada-persona-del-equipo", text: "Las diferencias de caja de cada persona se ven en **Reportes** (Plan Pro)." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-ver-el-historial-de-cierres-de-caja",
    title: "Cómo ver el historial de cierres de caja",
    category: "caja",
    summary: "Revisá todos los cierres: quién cerró, cuánto se esperaba, cuánto se contó y la diferencia.",
    plan: null,
    where: "**Reportes → Caja → Historial de caja**",
    steps: [
      { text: "Entrá a **Reportes** y abrí la solapa **Caja**." },
      { text: "Bajá hasta **Historial de caja**: cada fila muestra fecha, quién, horario, **Esperado**, **Contado** y **Diferencia**." },
      { text: "Tocá un cierre para ver el detalle de ese turno." },
    ],
    tips: [
      "Cuando todo coincide, la diferencia dice **Sin diferencia**.",
      "Con el Plan Básico ves las diferencias de cada empleado: quién cierra con faltantes seguido y cuánto suma.",
      "Con el Plan Pro tenés el historial completo de cierres.",
    ],
    keywords: ["historial de caja", "cierres", "diferencias", "quien cerro", "faltantes", "reporte de caja", "turnos"],
    related: ["como-cerrar-la-caja", "como-ver-lo-que-hizo-cada-persona-del-equipo"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-usar-mas-de-una-caja",
    title: "Cómo usar más de una caja a la vez",
    category: "caja",
    summary: "Cada persona abre su propia caja: cuántas pueden estar abiertas a la vez depende del plan.",
    plan: null,
    where: "**Caja**",
    steps: [
      { text: "Cada persona de tu equipo entra con su usuario y abre su caja desde **Caja → Abrir caja**." },
      { text: "Cada caja es independiente: lo que cobra cada uno suma a su propia caja y se cierra por separado." },
      { text: "En **Caja** podés ver el resumen del equipo: quién tiene la caja abierta y cuánto efectivo hay en cada una." },
    ],
    tips: [
      "Cajas abiertas a la vez: **Gratis** 1, **Básico** 2, **Pro** 6 y **Max** 6.",
      "Si llegaste al máximo, cerrá una caja o pasate a un plan más alto desde **Mi plan**.",
    ],
    keywords: ["varias cajas", "dos cajas", "mas de una caja", "empleados caja", "cajas abiertas", "limite de cajas", "equipo"],
    related: ["como-invitar-a-tu-equipo", "como-elegir-o-cambiar-de-plan"],
    connections: [
      { slug: "como-invitar-a-tu-equipo", text: "Cada persona del equipo puede trabajar con su propia caja." },
      { slug: "como-crear-una-sucursal", text: "Cada sucursal tiene sus propias cajas (Plan Max)." },
    ],
    updatedAt: UPDATED,
  },
];
