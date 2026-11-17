import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const stockDocs: DocArticle[] = [
  {
    slug: "como-ajustar-el-stock-de-un-producto",
    title: "Cómo ajustar el stock de un producto",
    category: "stock",
    summary: "Corregí cuántas unidades tenés de un producto: sumá, restá o dejá el número real. Queda registrado en Movimientos.",
    plan: "basico",
    where: "**Productos → tres puntitos del producto → Ajustar stock**",
    intro: [
      "Ajustás el stock cuando lo que dice Pesito no coincide con lo que realmente hay: por una rotura, un robo, un conteo o un error. Las ventas y las compras ya mueven el stock solas, así que esto es sólo para corregir.",
    ],
    steps: [
      { text: "En **Productos**, buscá el producto y tocá los tres puntitos de su fila." },
      { text: "Elegí **Ajustar stock**.", images: [{ name: "productos-ajustar-stock", alt: "Menú de tres puntitos de un producto con Ajustar stock resaltado" }] },
      {
        text: "Elegí cómo ajustar: **Sumar**, **Restar** o **Ajustar a** (dejás el stock en el número real que contaste).",
        note: "Con **Ajustar a** escribís la **Nueva cantidad en stock**; con Sumar o Restar, la **Cantidad**.",
      },
      { text: "Si querés, escribí un **Motivo** (rotura, conteo físico, etc.)." },
      { text: "Tocá **Confirmar**." },
    ],
    tips: [
      "Cada ajuste queda en la solapa **Movimientos**, con quién lo hizo y el motivo.",
      "Las compras y las ventas ajustan el stock solas: usá esto sólo para correcciones.",
      "Para contar muchos productos de una vez, mirá la guía de inventario físico (Plan Pro).",
    ],
    faq: [
      { q: "¿Cuál es la diferencia entre Sumar, Restar y Ajustar a?", a: "**Sumar** y **Restar** cambian el stock en la cantidad que pongas. **Ajustar a** deja el stock en el número exacto que contaste, sin que tengas que hacer la cuenta." },
      { q: "¿Por qué me dice que ese ya es el stock actual?", a: "Porque pusiste en **Ajustar a** el mismo número que ya figura. Poné el número real contado." },
      { q: "¿Para qué sirve el motivo?", a: "Para dejar anotado por qué ajustaste (rotura, conteo físico, etc.). Aparece después en **Movimientos**." },
      { q: "¿Se puede deshacer un ajuste?", a: "No se borra, pero podés hacer otro ajuste en sentido contrario. Cada uno queda registrado con quién lo hizo." },
      { q: "¿Dónde hago el ajuste?", a: "En los tres puntitos de la fila del producto (**Ajustar stock**). También desde **Movimientos** con **Nuevo movimiento manual**." },
    ],
    keywords: ["ajustar stock", "corregir stock", "stock", "sumar stock", "restar stock", "rotura", "merma", "conteo", "diferencia de stock"],
    related: ["como-ver-los-movimientos-de-stock", "como-hacer-un-inventario-fisico"],
    connections: [
      { slug: "como-ver-los-movimientos-de-stock", text: "Cada ajuste queda registrado, con quién lo hizo." },
      { slug: "como-ver-lo-que-hizo-cada-persona-del-equipo", text: "Los ajustes de stock se ven por persona (Plan Pro)." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-ver-los-movimientos-de-stock",
    title: "Cómo ver los movimientos de stock",
    category: "stock",
    summary: "Mirá el historial de todo lo que entró y salió: ventas, compras, ajustes y transferencias, y quién lo hizo.",
    plan: null,
    where: "**Productos → solapa Movimientos**",
    intro: [
      "Cada vez que el stock de un producto sube o baja, Pesito lo anota: una venta, una compra, un ajuste, una transferencia. Acá ves ese historial para entender por qué un producto tiene el stock que tiene.",
    ],
    steps: [
      { text: "Entrá a **Productos** y abrí la solapa **Movimientos**." },
      { text: "Buscá un producto por nombre, SKU o código de barras (**Buscar por producto, SKU o código de barras…**)." },
      { text: "Filtrá por período (por ejemplo **Este mes**) o por persona con **Filtrar por persona**." },
      { text: "Mirá el tipo de cada movimiento: **Venta**, **Compra**, **Ajuste**, **Transferencia**, **Anulación de venta** o **Stock inicial**, con la cantidad que entró o salió." },
    ],
    tips: [
      "Arriba ves los totales: unidades que entraron, unidades que salieron y productos distintos.",
      "Con **Nuevo movimiento manual** podés sumar, restar o ajustar el stock de un producto desde acá.",
    ],
    faq: [
      { q: "¿Qué tipos de movimiento hay?", a: "**Venta** (salió por una venta), **Compra** (entró por una compra), **Ajuste** (ajuste manual o inventario), **Transferencia** (pasó entre sucursales), **Anulación de venta** y **Stock inicial**." },
      { q: "¿Puedo ver quién hizo cada movimiento?", a: "Sí, el dueño y los administradores ven la columna **Hecho por**, y pueden filtrar con **Filtrar por persona**." },
      { q: "¿Qué plan necesito?", a: "Los movimientos de stock están desde el Plan Básico. En el Plan Gratis ves el aviso con el plan que los desbloquea." },
    ],
    keywords: ["movimientos", "historial de stock", "kardex", "entradas", "salidas", "quien toco el stock", "trazabilidad"],
    related: ["como-ajustar-el-stock-de-un-producto"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-ver-los-productos-con-stock-bajo",
    title: "Cómo ver los productos con stock bajo",
    category: "stock",
    summary: "Encontrá qué te falta reponer: filtrá por sin stock o por agotarse y cargá el stock mínimo de cada producto.",
    plan: "basico",
    where: "**Productos → Filtros → Estado del stock**",
    intro: [
      "Pesito te avisa qué productos están por agotarse comparando el stock con el **Stock mínimo** que cargaste en cada uno. Así sabés qué reponer antes de quedarte sin mercadería.",
    ],
    steps: [
      { text: "Entrá a **Productos** y tocá **Filtros**.", images: [{ name: "productos-filtros", alt: "Lista de Productos con el panel de filtros abierto" }] },
      { text: "En **Estado del stock** elegí **Sin stock** o **Por agotarse** (los que están en el mínimo o por debajo)." },
      { text: "Para que un producto avise a tiempo, abrilo con el lápiz y cargá su **Stock mínimo**." },
    ],
    tips: [
      "En el panel de **Alertas** de Productos también ves los productos con stock bajo.",
      "El filtro **Sin mínimo** te muestra los productos a los que todavía no les cargaste un stock mínimo.",
    ],
    faq: [
      { q: "¿Cómo sé qué es stock bajo?", a: "Un producto está por agotarse cuando su stock es igual o menor a su stock mínimo. Si no cargaste mínimo, no hay manera de avisarte: por eso existe el filtro **Sin mínimo**." },
      { q: "¿Dónde veo el aviso?", a: "En **Avisos de Productos**, en la campana y en el menú lateral." },
      { q: "¿Qué hago cuando falta?", a: "Cargá la compra al proveedor (**Compras**). Con el Plan Max, **Qué comprar** te arma el pedido." },
    ],
    keywords: ["stock bajo", "sin stock", "por agotarse", "reponer", "minimo", "alertas", "faltantes", "que comprar"],
    related: ["como-ajustar-el-stock-de-un-producto", "como-registrar-una-compra"],
    connections: [
      { slug: "como-saber-que-productos-comprar", text: "**Qué comprar** (Plan Max) arma el pedido de lo que falta." },
      { slug: "como-registrar-una-compra", text: "Al registrar la compra, el stock sube." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-hacer-un-inventario-fisico",
    title: "Cómo hacer un inventario físico",
    category: "stock",
    summary: "Contá lo que tenés en el negocio, compará con el sistema y aplicá los ajustes de una sola vez.",
    plan: "pro",
    where: "**Inventario físico**",
    intro: [
      "El inventario físico es contar lo que tenés y comparar contra lo que dice Pesito. Contás producto por producto (con lector o a mano), revisás las diferencias y, si estás de acuerdo, aplicás todos los ajustes juntos.",
    ],
    steps: [
      { text: "Entrá a **Inventario físico**." },
      { text: "En **Qué querés contar** elegí **Todos los productos activos**, **Una marca** o **Los de un proveedor**. Si querés, ponele un **Nombre (opcional)**." },
      { text: "Tocá **Empezar a contar**." },
      {
        text: "Buscá cada producto (o escaneá su código de barras) y escribí cuántas unidades contaste.",
        note: "Escanear un código suma 1 al contado.",
      },
      { text: "Mirá las pestañas **Todos**, **Contados**, **Sin contar** y **Con diferencia** para revisar lo que falta." },
      { text: "Cuando termines, tocá **Aplicar ajustes**. El stock queda igual a lo que contaste." },
    ],
    tips: [
      "Antes de aplicar, la columna **Sistema** te muestra cuánto debería haber y **Diferencia** cuánto falta o sobra.",
      "Los inventarios anteriores quedan en **Inventarios anteriores**, con **Ver detalle**.",
      "Los ajustes quedan registrados en **Movimientos**.",
    ],
    faq: [
      { q: "¿Tengo que contar todo de una vez?", a: "No. Podés empezar con **Todos los productos activos**, con **Una marca** o con **Los de un proveedor**, y seguir otro día." },
      { q: "¿Qué pasa con los productos que no cuento?", a: "Quedan en la pestaña **Sin contar** para que los revises antes de aplicar los ajustes." },
      { q: "¿Se puede deshacer?", a: "Los ajustes ya aplicados no se borran, pero quedan registrados en **Movimientos** y el inventario queda guardado en **Inventarios anteriores**, con su detalle." },
      { q: "¿Cómo uso el lector de códigos?", a: "Con el cursor en el buscador, escaneá el código: suma 1 al contado de ese producto." },
    ],
    keywords: ["inventario", "inventario fisico", "contar stock", "conteo", "recuento", "diferencias", "escanear", "balance de stock"],
    related: ["como-ajustar-el-stock-de-un-producto", "como-ver-los-movimientos-de-stock"],
    connections: [
      { slug: "como-ver-los-movimientos-de-stock", text: "Los ajustes del inventario quedan en **Movimientos**." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-transferir-mercaderia-entre-sucursales",
    title: "Cómo transferir mercadería entre sucursales",
    category: "stock",
    summary: "Pasá productos de una sucursal a otra: el stock sale de una y entra en la otra, y queda registrado.",
    plan: "max",
    where: "**Productos → Movimientos → Transferir a otra sucursal**",
    before: ["Tener la segunda sucursal creada (Plan Max, hasta 2 sucursales)."],
    steps: [
      { text: "Entrá a **Productos**, abrí la solapa **Movimientos** y tocá **Transferir a otra sucursal**." },
      { text: "En **Hacia** elegí la sucursal de destino." },
      { text: "En **Agregar producto** buscá cada producto y poné cuántas unidades pasás." },
      { text: "Si querés, escribí una **Nota (opcional)**." },
      { text: "Tocá **Transferir**." },
    ],
    tips: [
      "Cada sucursal tiene su propio stock y sus cajas.",
      "En **Movimientos** la transferencia aparece como **Pasó entre sucursales**.",
    ],
    faq: [
      { q: "¿Cuántas sucursales puedo tener?", a: "Hasta 2 con el Plan Max, cada una con su propio stock y sus cajas." },
      { q: "¿Dónde queda registrada la transferencia?", a: "En **Movimientos**, como **Pasó entre sucursales**, con la nota que hayas puesto." },
    ],
    keywords: ["transferir", "transferencia", "sucursal", "pasar mercaderia", "mover stock", "otro local", "deposito"],
    related: ["como-crear-una-sucursal", "como-ver-los-movimientos-de-stock"],
    connections: [
      { slug: "como-crear-una-sucursal", text: "Hace falta tener la segunda sucursal creada." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-corregir-un-producto-con-stock-negativo",
    title: "Cómo corregir un producto con stock negativo",
    category: "stock",
    summary: "Si un producto figura con menos de cero, llevalo al número real con Ajustar stock.",
    plan: null,
    where: "**Productos → Avisos de Productos → Números para revisar**",
    steps: [
      { text: "En **Productos** abrí **Avisos de Productos** y tocá el grupo de **stock negativo** para listarlos." },
      { text: "Contá cuántas unidades hay realmente." },
      { text: "En los tres puntitos del producto elegí **Ajustar stock**, usá **Ajustar a** y poné la cantidad real." },
      { text: "Confirmá. Queda registrado en **Movimientos**." },
    ],
    tips: [
      "Suele pasar cuando se vendió sin cargar antes la compra: cargá siempre las compras para que el stock suba.",
      "Revisá en **Movimientos** qué ventas lo dejaron en negativo.",
    ],
    faq: [
      { q: "¿Cómo puede quedar el stock en negativo?", a: "Suele pasar cuando la mercadería llegó pero no cargaste la compra, y se vendió igual. Corregilo con **Ajustar stock** y cargá las compras a tiempo para que no se repita." },
    ],
    keywords: ["stock negativo", "menos de cero", "stock en menos", "stock mal", "corregir stock", "me da negativo"],
    connections: [
      { slug: "como-registrar-una-compra", text: "Cargar las compras a tiempo evita el stock negativo." },
      { slug: "como-hacer-una-venta", text: "El stock baja con cada venta en el **Punto de Venta**." },
    ],
    related: ["como-ajustar-el-stock-de-un-producto", "como-ver-los-movimientos-de-stock"],
    updatedAt: UPDATED,
  },
];
