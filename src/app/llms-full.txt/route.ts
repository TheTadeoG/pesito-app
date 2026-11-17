import { siteUrl } from "@/lib/utils";
import { planDefinitions } from "@/lib/plan-features";
import { docCategories, docsInCategory } from "@/lib/docs";

// /llms-full.txt: el texto completo de las guías de ayuda de Pesito (pasos, consejos y dudas frecuentes), en Markdown,
// para que los modelos de lenguaje respondan "cómo hago X en Pesito" con el paso a paso real. Misma fuente que /ayuda
// (src/lib/docs): una guía nueva aparece sola. Se genera una vez al compilar.
export const dynamic = "force-static";

export function GET() {
  const guides = docCategories
    .map((cat) => {
      const articles = docsInCategory(cat.id);
      if (articles.length === 0) return "";
      const body = articles
        .map((a) => {
          const plan = a.plan ? `Disponible desde el ${planDefinitions[a.plan].name}.` : "Disponible en todos los planes.";
          const lines: string[] = [
            `### ${a.title}`,
            "",
            `URL: ${siteUrl}/ayuda/${a.slug}`,
            `${a.summary} ${plan} Dónde: ${a.where}. Última revisión: ${a.updatedAt}.`,
          ];
          if (a.intro?.length) lines.push("", ...a.intro.flatMap((p) => [p, ""]).slice(0, -1));
          if (a.before?.length) lines.push("", "Antes de empezar:", ...a.before.map((b) => `- ${b}`));
          lines.push("", "Paso a paso:", ...a.steps.map((s, i) => `${i + 1}. ${s.text}${s.note ? ` (${s.note})` : ""}`));
          if (a.tips?.length) lines.push("", "Tené en cuenta:", ...a.tips.map((t) => `- ${t}`));
          if (a.faq?.length) lines.push("", "Dudas frecuentes:", ...a.faq.flatMap((f) => [`- ${f.q} ${f.a}`]));
          if (a.connections?.length) lines.push("", "Se conecta con:", ...a.connections.map((c) => `- ${c.text} (${siteUrl}/ayuda/${c.slug})`));
          return lines.join("\n");
        })
        .join("\n\n");
      return `## ${cat.title}\n\n${cat.description}\n\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const text = `# Pesito: guías de ayuda (texto completo)

> Pesito es un sistema de punto de venta en la nube para negocios de Argentina: ventas, stock, caja, clientes con fiado, compras y reportes. Estas son sus guías paso a paso, con los nombres reales de los botones y el plan que incluye cada función. Lo que todavía no existe no tiene guía. Versión resumida del sitio: ${siteUrl}/llms.txt

${guides}
`;

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
