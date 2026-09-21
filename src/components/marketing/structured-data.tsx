import { faqs } from "@/components/marketing/faq";
import { siteUrl } from "@/lib/utils";

export function StructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Pesito",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Sistema de punto de venta, inventario, clientes y caja para kioscos y almacenes de barrio.",
      offers: [
        {
          "@type": "Offer",
          name: "Plan Gratis",
          price: "0",
          priceCurrency: "ARS",
        },
        {
          "@type": "Offer",
          name: "Plan Pro",
          price: "9900",
          priceCurrency: "ARS",
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Pesito",
      url: siteUrl,
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
