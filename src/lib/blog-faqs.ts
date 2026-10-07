import type { BlogFaq } from "@/lib/blog-data";
import { FREE_PLAN_SALES_LIMIT_LABEL } from "@/lib/plan-features";

// Preguntas y respuestas concretas de cada nota (se muestran al final y salen
// como FAQPage en el JSON-LD). Cada respuesta se entiende sola y nombra a
// Pesito sólo con funciones que existen; lo que falta (factura electrónica) se
// dice. Planes: ver plan-features.ts.
const f = (question: string, answer: string): BlogFaq => ({ question, answer });

export const blogFaqs: Record<string, BlogFaq[]> = {
  "como-armar-lista-de-precios": [
    f("¿Cómo se calcula el precio de venta de un producto?", "Sumás el costo del producto y le aplicás tu margen: precio = costo × (1 + margen). Con un costo de $1.000 y un margen del 40%, el precio es $1.400. Después sumás el IVA si corresponde a tu situación."),
    f("¿Qué diferencia hay entre margen y recargo?", "El recargo se calcula sobre el costo y el margen sobre el precio de venta. Con un costo de $1.000 y un precio de $1.400, el recargo es del 40% y el margen real es del 28,6%."),
    f("¿Cada cuánto tengo que revisar la lista de precios?", "Revisala cada vez que cambia el costo de tus proveedores y, como mínimo, una vez por mes si hay inflación alta. En Pesito, el historial de precios de cada producto te muestra cuándo y cuánto cambió."),
  ],
  "arqueo-de-caja-que-es-como-se-hace": [
    f("¿Qué es un arqueo de caja?", "Es contar el efectivo que hay en la caja y compararlo con lo que el sistema dice que debería haber. La diferencia puede ser un sobrante o un faltante."),
    f("¿Cada cuánto se hace el arqueo de caja?", "Al cerrar cada turno o cada día. En Pesito, la caja diaria tiene cierre y arqueo en todos los planes, incluido el Gratis."),
    f("¿Qué hago si la caja no cierra?", "Revisá primero retiros, gastos y cobros con tarjeta o transferencia cargados como efectivo. Si queda una diferencia, registrala con su motivo en vez de ajustarla en silencio. Desde el Plan Esencial, Pesito muestra las diferencias de caja por empleado."),
  ],
  "factura-a-b-c-diferencia": [
    f("¿Cuál es la diferencia entre factura A, B y C?", "La A la emite un responsable inscripto a otro responsable inscripto; la B, un responsable inscripto a un consumidor final; y la C la emiten los monotributistas. El tipo depende de la condición frente al IVA de quien vende y de quien compra."),
    f("¿Pesito emite factura electrónica?", "Todavía no. Pesito no emite facturas electrónicas de ARCA/AFIP; podés indicar el tipo de comprobante de cada venta e imprimir un ticket interno, que no es una factura fiscal."),
    f("¿Un monotributista tiene que emitir factura C?", "Sí: el monotributista emite factura C a sus clientes. Consultá con tu contador o en ARCA los plazos y los casos de excepción de tu actividad."),
  ],
  "como-elegir-sistema-para-tu-comercio": [
    f("¿Qué tengo que mirar al elegir un sistema para mi negocio?", "El precio total a 12 meses, si hay plan gratis, si funciona desde el navegador o el celular, si tiene fiado, caja y stock, si exporta tus datos y si emite factura electrónica."),
    f("¿Conviene un sistema gratis?", `Conviene para probar y para negocios chicos si no vence. El Plan Gratis de Pesito no pide tarjeta e incluye ventas, stock, caja, fiado y compras (${FREE_PLAN_SALES_LIMIT_LABEL}).`),
    f("¿Cuánto tarda en implementarse un sistema?", "Un sistema en la nube se empieza a usar el mismo día: creás la cuenta, cargás los productos (a mano o con Excel desde el Plan Esencial en Pesito) y vendés."),
  ],
  "como-controlar-el-fiado": [
    f("¿Cómo llevo el fiado sin perder plata?", "Registrá cada fiado a nombre del cliente, poné un límite de crédito, anotá cada pago y revisá semanalmente los saldos más viejos. En Pesito, el panel de Clientes muestra cuánto te deben y hace cuánto."),
    f("¿Cómo le reclamo una deuda a un cliente sin pelearme?", "Con un mensaje breve, amable y con el monto exacto. Pesito arma el mensaje con el saldo y lo abrís por WhatsApp con un botón."),
    f("¿Se pueden registrar pagos parciales?", "Sí. En Pesito cada pago parcial se anota y el saldo se actualiza solo; el fiado está incluido en todos los planes, incluso el Gratis."),
  ],
  "como-controlar-el-stock": [
    f("¿Cómo sé cuánto stock tengo realmente?", "Con un sistema que descuente en cada venta y sume en cada compra, más un conteo físico periódico de lo más caro. En Pesito el stock se actualiza solo con cada venta y compra en todos los planes."),
    f("¿Qué es el stock mínimo?", "Es la cantidad por debajo de la cual tenés que reponer un producto. Desde el Plan Esencial, Pesito avisa los faltantes y arma la lista para reponer."),
    f("¿Qué hago con las mermas y roturas?", "Registralas como un ajuste con su motivo, no restes a ciegas: así sabés cuánto perdés y por qué. Pesito guarda el historial de movimientos de stock desde el Plan Esencial."),
  ],
  "como-actualizar-precios-con-inflacion": [
    f("¿Cada cuánto conviene actualizar los precios con inflación alta?", "Cuando sube el costo, no cuando cierra el mes. Lo ideal es revisar al recibir cada compra, porque vender con costos viejos achica tu ganancia sin que lo notes."),
    f("¿Cómo subo todos los precios de una vez?", "En Pesito, el Plan Pro permite aumentos masivos de precios y costos en segundos, con opción de deshacer y volver a un precio anterior desde el historial."),
    f("¿Cómo sé si estoy vendiendo a pérdida?", "Comparando el precio con el costo actualizado. Desde el Plan Pro, el reporte de ganancias de Pesito muestra qué te deja más plata y qué productos vendés a pérdida."),
  ],
  "como-controlar-la-caja-con-empleados": [
    f("¿Cómo controlo la caja si tengo empleados?", "Con un usuario por empleado, cierre de caja con arqueo en cada turno y reporte de diferencias. En Pesito, el control de caja por empleado está desde el Plan Esencial."),
    f("¿Cuántos usuarios puedo tener en Pesito?", "1 en el Plan Gratis, 2 en el Esencial y 6 en el Pro y el IA, con 1, 2 y 6 cajas respectivamente."),
    f("¿Qué hago si un empleado tiene diferencias seguidas?", "Mirá el patrón antes de acusar: horarios, medios de pago y retiros. Con las diferencias por empleado, la conversación se apoya en datos y no en sospechas."),
  ],
  "como-manejar-varias-sucursales": [
    f("¿Cómo manejo el stock de más de una sucursal?", "Con un sistema donde cada sucursal tenga su propio stock y puedas pasar mercadería entre ellas. En Pesito, el Plan IA incluye 2 sucursales, cada una con su stock y pases entre sucursales."),
    f("¿Puedo ver las ventas de cada sucursal por separado?", "Sí: en Pesito podés filtrar ventas y caja por sucursal. En el Plan IA, Reportes también separa las ganancias por sucursal."),
    f("¿Qué plan de Pesito necesito para tener sucursales?", "El Plan IA, que incluye 2 sucursales además de todo lo del Plan Pro."),
  ],
  "como-saber-cuanto-ganas": [
    f("¿Cómo calculo cuánto gano en mi negocio?", "Ganancia = ventas − costo de la mercadería vendida − gastos. Sin el costo actualizado de cada producto, el número es una estimación."),
    f("¿Cuál es la diferencia entre ventas y ganancia?", "Las ventas son lo que cobrás; la ganancia es lo que te queda después de pagar la mercadería y los gastos. Un negocio puede vender mucho y ganar poco."),
    f("¿Pesito me muestra la ganancia?", "Sí, desde el Plan Pro: el reporte de ganancias muestra qué productos te dejan más plata y cuáles vendés a pérdida. Todos los planes muestran ventas, ticket promedio y medios de pago."),
  ],
};
