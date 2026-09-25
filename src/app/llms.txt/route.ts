import { siteUrl } from "@/lib/utils";
import { paidPlanDefinitions, planDefinitions } from "@/lib/plan-features";
import { rubroPages } from "@/lib/pesito-para-data";
import { comparisonBlocks } from "@/lib/comparacion-data";
import { blogPosts } from "@/lib/blog-data";

// /llms.txt (https://llmstxt.org): resumen en Markdown del sitio para los
// modelos de lenguaje. Se arma con los mismos datos que el sitemap, así una
// página nueva de blog, rubro o comparación aparece sola.
// Sólo depende de datos del código: se genera una vez al compilar.
export const dynamic = "force-static";

export function GET() {
  const link = (title: string, path: string, note?: string) =>
    `- [${title}](${siteUrl}${path})${note ? `: ${note}` : ""}`;

  const plans = [planDefinitions.gratis, ...paidPlanDefinitions]
    .map((p) => `- ${p.name}: ${p.price === 0 ? "gratis, sin vencimiento" : `${p.priceLabel} por mes, IVA incluido`}`)
    .join("\n");

  const body = `# Pesito

> Pesito es un sistema de punto de venta en la nube para comercios de barrio de Argentina (kioscos, almacenes, verdulerías, locales de ropa y más): ventas con lector de código de barras, stock, caja diaria, clientes con fiado, compras a proveedores y reportes. Funciona desde el navegador y el celular, sin instalar nada. Se empieza gratis y se elige un plan pago cuando el negocio crece.

Funciones destacadas: aumentos masivos de precios o costos por proveedor o por marca (en porcentaje o monto fijo), historial de precios por producto, varias cajas y usuarios, cuentas corrientes de clientes y proveedores.

## Planes

${plans}

## Páginas principales

${link("Inicio", "/", "qué es Pesito, funciones y precios")}
${link("Cómo funciona", "/como-funciona")}
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
