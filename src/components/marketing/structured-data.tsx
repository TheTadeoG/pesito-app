import { featuredFaqs as faqs } from "@/lib/faq-data";
import { siteUrl } from "@/lib/utils";
import { planOrder } from "@/lib/subscription";
import { planDefinitions } from "@/lib/plan-features";

export function StructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Pesito",
      image: `${siteUrl}/icon.png`,
      publisher: { "@id": `${siteUrl}/#organization` },
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Sistema de gestión y punto de venta (POS) para negocios de Argentina: ventas con lector de códigos, stock, caja, clientes con fiado, compras y reportes.",
      offers: planOrder.map((plan) => ({
        "@type": "Offer",
        name: planDefinitions[plan].name,
        price: String(planDefinitions[plan].price),
        priceCurrency: "ARS",
        ...(planDefinitions[plan].promoLabel
          ? { description: `Precio mensual, IVA incluido. Primer mes ${planDefinitions[plan].promoLabel} (promo de lanzamiento).` }
          : {}),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Pesito",
      alternateName: ["Pesito POS"],
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/icon.png`, width: 512, height: 512 },
      image: `${siteUrl}/icon.png`,
      description:
        "Pesito es un sistema de gestión y punto de venta en la nube para negocios de Argentina: ventas, stock, caja, clientes con fiado, compras y reportes.",
      areaServed: "AR",
      knowledgeAbout: ["punto de venta", "control de stock", "caja", "fiado y cuenta corriente", "factura electrónica ARCA"],
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "soporte@pesito.com.ar", availableLanguage: "es-AR" },
      // Perfiles oficiales. Sumar acá la ficha de G2, LinkedIn, YouTube y Google Business Profile cuando existan (misma imagen de logo en todos).
      sameAs: ["https://www.instagram.com/pesito.arg", "https://www.g2.com/products/pesito/reviews"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Pesito",
      url: siteUrl,
      inLanguage: "es-AR",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
