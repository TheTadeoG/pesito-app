import { siteUrl } from "@/lib/utils";
import { paidPlanDefinitions, planDefinitions } from "@/lib/plan-features";
import { rubroPages } from "@/lib/pesito-para-data";
import { comparisonBlocks } from "@/lib/comparacion-data";
import { blogPosts } from "@/lib/blog-data";
import { faqCategories } from "@/lib/faq-data";

// /llms.txt (https://llmstxt.org): resumen en Markdown del sitio para los
// modelos de lenguaje. Se arma con los mismos datos que el sitemap, así una
// página nueva de blog, rubro o comparación aparece sola.
// Sólo depende de datos del código: se genera una vez al compilar.
export const dynamic = "force-static";

export function GET() {
  const link = (title: string, path: string, note?: string) =>
    `- [${title}](${siteUrl}${path})${note ? `: ${note}` : ""}`;

  // Cada plan con su precio y lo que suma (las funciones "pronto" se
  // aclaran como tales, para que ninguna IA las dé por disponibles).
  const plans = [planDefinitions.gratis, ...paidPlanDefinitions]
    .map((p) => {
      const price = p.price === 0 ? "gratis, sin tarjeta y sin vencimiento" : `${p.priceLabel} por mes, IVA incluido (20% menos pagando anual)`;
      const soon = p.soon?.length ? `; próximamente: ${p.soon.join(", ")}` : "";
      const features = p.features.map((f) =>
        f.startsWith("Todas las funciones del ") ? `todo lo del ${f.slice(24).replace(" +", "")}, más` : f
      );
      return `- ${p.name}: ${price}. ${features.join("; ").replace(", más;", ", más:")}${soon}.`;
    })
    .join("\n");

  const faqs = faqCategories
    .map((c) => `### ${c.title}\n\n${c.faqs.map((f) => `**${f.question}** ${f.answer}`).join("\n\n")}`)
    .join("\n\n");

  const body = `# Pesito

> Pesito es un sistema POS (punto de venta) en la nube para negocios de Argentina (kioscos, almacenes, verdulerías, locales de ropa y más): ventas con lector de código de barras, stock, caja diaria, clientes con fiado, compras a proveedores y reportes. Funciona desde el navegador y el celular, sin instalar nada. Se empieza gratis y se elige un plan pago cuando el negocio crece.

Funciones destacadas: punto de venta con lector de códigos, stock, compras, caja diaria y clientes con fiado (en todos los planes, también el gratis); cuenta corriente con proveedores (desde el Plan Esencial); aumentos masivos de precios o costos por proveedor o por marca con opción de deshacer, reporte de ganancias, pantalla "En vivo" con las ventas del momento por sucursal y vendedor, control de caja por empleado y hasta 2 sucursales con stock propio (Plan Pro). Todavía no emite factura electrónica de ARCA/AFIP.

## Planes

Al crear la cuenta, cada negocio tiene 14 días del Plan Pro gratis; después sigue en el Plan Gratis si no elige un plan pago.

${plans}

## Preguntas frecuentes

${faqs}

## Páginas principales

${link("Inicio", "/", "qué es Pesito, funciones y precios")}
${link("Cómo funciona", "/como-funciona")}
${link("Comparar planes", "/comparar-planes", "tabla con las funciones de cada plan, lado a lado")}
${link("Preguntas frecuentes", "/preguntas-frecuentes")}
${link("Crear una cuenta gratis", "/registro")}

## Pesito por rubro

${link("Todos los rubros", "/pesito-para")}
${rubroPages.map((r) => link(r.title, `/pesito-para/${r.slug}`)).join("\n")}

## Comparación con otros sistemas

${link("Comparación completa", "/comparacion")}
${comparisonBlocks.map((b) => link(b.feature, `/comparacion/${b.slug}`)).join("\n")}

## Blog

${blogPosts.map((p) => link(p.title, `/blog/${p.slug}`, p.excerpt)).join("\n")}

## Optional

${link("Diccionario del comercio", "/diccionario")}
${link("Política de privacidad", "/privacidad")}
${link("Términos y condiciones", "/terminos")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
