import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const reportesDocs: DocArticle[] = [
  {
    slug: "como-ver-cuanto-vendiste-y-cuanto-ganaste",
    title: "Cómo ver cuánto vendiste y cuánto ganaste",
    category: "reportes",
    summary: "Mirá tus ingresos, los productos que más venden y los que más ganancia dejan, por período.",
    plan: null,
    where: "**Reportes**",
    steps: [
      { text: "Entrá a **Reportes**." },
      { text: "Elegí el período arriba (hoy, la semana, el mes o uno propio)." },
      { text: "Mirá los **Indicadores principales** y los **Ingresos por período**." },
      { text: "Más abajo ves **Productos más vendidos**, **Métodos de pago**, **Mejores clientes** y **Quién te debe**." },
      { text: "Con **Personalizar Reportes** elegís qué secciones ver (se guarda en este dispositivo)." },
    ],
    tips: [
      "La **Ganancia est.**, **Productos que más ganancia dejan** y **Productos vendidos a pérdida** son del Plan Pro: se calculan con el costo cargado en cada producto.",
      "Con **Stock valorizado** ves cuánta plata tenés en mercadería, al costo o a precio de venta.",
      "La comparación con el período anterior es del Plan Pro.",
    ],
    keywords: ["reportes", "ventas del mes", "ganancia", "ingresos", "mas vendidos", "estadisticas", "balance", "cuanto gane", "stock valorizado"],
    related: ["como-ver-las-ventas-de-cada-vendedor", "como-ver-el-historial-de-ventas"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-ver-las-ventas-de-cada-vendedor",
    title: "Cómo ver las ventas de cada vendedor",
    category: "reportes",
    summary: "Filtrá Reportes por persona del equipo y mirá cuánto vendió y las diferencias de caja de cada una.",
    plan: "basico",
    where: "**Reportes → Todos los vendedores**",
    steps: [
      { text: "Entrá a **Reportes**." },
      { text: "En el selector **Todos los vendedores** elegí a la persona." },
      { text: "Todo el reporte pasa a mostrar sólo lo que vendió esa persona." },
      { text: "En **Ventas por vendedor** ves cuánto vende cada uno, y en **Diferencias de caja por vendedor** los faltantes y sobrantes de sus cierres." },
    ],
    tips: ["Si una persona ya no está en el equipo, sus ventas aparecen como **Usuario eliminado**."],
    keywords: ["vendedor", "empleado", "ventas por vendedor", "quien vendio", "diferencias de caja", "faltante", "comisiones"],
    related: ["como-ver-lo-que-hizo-cada-persona-del-equipo", "como-invitar-a-tu-equipo"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-ver-lo-que-hizo-cada-persona-del-equipo",
    title: "Cómo ver lo que hizo cada persona del equipo",
    category: "reportes",
    summary: "Controlá ventas, anulaciones, ajustes de stock, retiros y cierres de caja de cada usuario.",
    plan: "pro",
    where: "**Reportes → Control por usuario**",
    steps: [
      { text: "Entrá a **Reportes** y abrí **Control por usuario**." },
      { text: "Elegí una persona en **Por persona** (“Tocá a alguien para ver sólo lo que hizo”) o dejá **Todas las personas**." },
      { text: "Filtrá por tipo: **Ventas**, **Anulaciones**, **Ajustes de stock**, **Ingresos**, **Retiros** o **Cierres de caja**." },
      { text: "Mirá cada movimiento con su fecha, su detalle y la diferencia de caja en los cierres." },
    ],
    tips: ["Sirve para detectar anulaciones o ajustes de stock raros y quién los hizo."],
    keywords: ["control por usuario", "actividad", "auditoria", "quien hizo", "anulaciones", "retiros", "empleados", "seguridad"],
    related: ["como-ver-las-ventas-de-cada-vendedor"],
    updatedAt: UPDATED,
  },
];
