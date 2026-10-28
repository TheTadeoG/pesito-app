import type { LifecycleTemplate } from "./lifecycle";

// Texto de cada correo automático. Voseo, corto, un solo pedido por mail y el link directo.
// Texto plano: se lee igual en cualquier casilla y no cae en promociones.

export interface PlanInfo {
  name: string;
  priceLabel: string;
  promoLabel?: string;
}

export interface LifecycleContext {
  orgName: string;
  siteUrl: string;
  /** Link para no recibir más estos correos. */
  unsubscribeUrl: string;
  plans: { basico: PlanInfo; pro: PlanInfo };
  trialEndsAt?: string | null;
  graceUntil?: string | null;
}

const date = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso)) : "";

export function renderLifecycleEmail(template: LifecycleTemplate, ctx: LifecycleContext): { subject: string; text: string } {
  const { siteUrl: site } = ctx;
  const footer = [
    "",
    "—",
    "Recibís este correo porque creaste un negocio en Pesito. Podés responderlo si tenés alguna duda.",
    `Si no querés recibir más estos mensajes de ayuda, entrá acá: ${ctx.unsubscribeUrl}`,
  ];
  const lines = (...parts: (string | null)[]) => parts.filter((p): p is string => p !== null);

  switch (template) {
    case "welcome":
      return {
        subject: `Bienvenido a Pesito, ${ctx.orgName}`,
        text: lines(
          "¡Hola! Gracias por crear tu negocio en Pesito.",
          "",
          "Para hacer tu primera venta hoy alcanzan 3 pasos:",
          `1. Cargá tu primer producto (nombre y precio alcanzan): ${site}/productos`,
          `2. Abrí la caja: ${site}/caja`,
          `3. Cobrá tu primera venta: ${site}/pos`,
          "",
          "Si ya tenés tus productos en una planilla de Excel, subila desde Productos → Acciones → Cargar desde Excel (durante tu prueba de 14 días del Plan Pro está incluido).",
          "",
          "Cualquier duda, respondé este correo."
        )
          .concat(footer)
          .join("\n"),
      };
    case "add_products":
      return {
        subject: "Cargá tus primeros productos y probá una venta",
        text: lines(
          `Hola! Vimos que en ${ctx.orgName} todavía no cargaste productos.`,
          "",
          "Es lo único que falta para vender: con el nombre y el precio ya podés cobrar.",
          `→ Cargar un producto: ${site}/productos`,
          "",
          "Si tenés una lista en Excel, no hace falta cargarlos de a uno: Productos → Acciones → Cargar desde Excel.",
          "Si te trabaste en algo, respondé este correo y te ayudamos."
        )
          .concat(footer)
          .join("\n"),
      };
    case "first_sale":
      return {
        subject: "Ya cargaste tus productos: falta tu primera venta",
        text: lines(
          `Hola! En ${ctx.orgName} ya cargaste tus productos. Falta lo mejor: cobrar la primera venta.`,
          "",
          `1. Abrí la caja (con cuánto efectivo arrancás): ${site}/caja`,
          `2. Buscá el producto o escaneá el código y cobrá: ${site}/pos`,
          "",
          "Te sale el vuelto, el ticket y el stock se descuenta solo.",
          "Si algo no se entiende, respondé este correo."
        )
          .concat(footer)
          .join("\n"),
      };
    case "trial_ending": {
      const e = ctx.plans.basico;
      return {
        subject: `Tu prueba del Plan Pro termina el ${date(ctx.trialEndsAt)}`,
        text: lines(
          `Hola! La prueba gratis del Plan Pro de ${ctx.orgName} termina el ${date(ctx.trialEndsAt)}.`,
          "",
          "Después pasás al Plan Gratis, sin perder ningún dato. Lo que cambia son las funciones de los planes pagos (por ejemplo, los aumentos masivos de precios y los reportes avanzados).",
          "",
          `Si querés seguir con todo: ${e.name}${e.promoLabel ? `, el primer mes ${e.promoLabel}` : ""} (después ${e.priceLabel} por mes), o el ${ctx.plans.pro.name} (${ctx.plans.pro.priceLabel}).`,
          `→ Elegir un plan: ${site}/planes`,
          "",
          "Se cobra por Mercado Pago y lo cancelás cuando quieras."
        )
          .concat(footer)
          .join("\n"),
      };
    }
    case "trial_ended":
      return {
        subject: "Terminó tu prueba del Plan Pro",
        text: lines(
          `Hola! La prueba del Plan Pro de ${ctx.orgName} terminó y ahora tenés el Plan Gratis. Tus productos, clientes y ventas siguen ahí.`,
          "",
          `Si extrañás alguna función de los planes pagos, podés volver a activarla cuando quieras: ${site}/planes`,
          "",
          "Si el Plan Gratis te alcanza, no tenés que hacer nada."
        )
          .concat(footer)
          .join("\n"),
      };
    case "payment_failed":
      return {
        subject: "No pudimos cobrar tu plan de Pesito",
        text: lines(
          `Hola! No pudimos cobrar el plan de ${ctx.orgName} con Mercado Pago.`,
          "",
          ctx.graceUntil
            ? `Tenés hasta el ${date(ctx.graceUntil)} para actualizar el medio de pago; si no, el negocio pasa al Plan Gratis (sin perder datos).`
            : "Actualizá el medio de pago para no perder las funciones de tu plan.",
          `→ Actualizar el medio de pago: ${site}/planes`,
          "",
          "Si ya lo resolviste, ignorá este correo."
        )
          .concat(footer)
          .join("\n"),
      };
  }
}
