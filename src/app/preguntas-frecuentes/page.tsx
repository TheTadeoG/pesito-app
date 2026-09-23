import Link from "next/link";
import { ArrowRight, ChevronDown, HelpCircle } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { faqs } from "@/components/marketing/faq";
import { pageMetadata } from "@/lib/seo";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata = pageMetadata({
  title: "Preguntas frecuentes sobre Pesito",
  description:
    "Todo lo que preguntan los comerciantes antes de empezar: internet, lector de código de barras, fiado, cajas por usuario y el plan gratuito.",
  path: "/preguntas-frecuentes",
});

export default function PreguntasFrecuentesPage() {
  const structuredData = {
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
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <HelpCircle className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Preguntas frecuentes
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Lo que más nos preguntan los comerciantes de barrio antes de empezar a usar Pesito.
          </p>

          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-card border border-border bg-card p-5 open:pb-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                  {faq.question}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿No encontraste tu pregunta?{" "}
            <a
              href={whatsappLink("Hola! Tengo una pregunta sobre Pesito.")}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Escribinos por WhatsApp
            </a>
            .
          </p>

          <div className="mt-14 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold">Probalo vos mismo, sin compromiso</h2>
            <p className="max-w-md text-primary-foreground/85">
              Plan gratis de verdad, no una prueba con fecha de vencimiento.
            </p>
            <Link href="/registro">
              <Button size="lg" variant="onColor">
                Empezar gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
