import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { comparisonBlocks } from "@/lib/comparacion-data";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pesito vs. otros sistemas de gestión",
  description:
    "Comparación honesta, función por función: fiado, plan gratis, medios de pago, facturación, soporte y más — qué suele faltar en otros sistemas y cómo lo resuelve Pesito.",
  path: "/comparacion",
});

export default function ComparacionPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Comparación de funcionalidades de Pesito",
    url: `${siteUrl}/comparacion`,
    itemListElement: comparisonBlocks.map((block, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: block.feature,
      description: block.pesito,
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
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Pesito frente a otros sistemas de gestión
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Función por función, sin apuntar a ninguna marca puntual: esto es lo que suele
              faltar en otros sistemas y cómo lo resolvimos en Pesito.
            </p>
          </div>

          <div className="mt-14 space-y-6">
            {comparisonBlocks.map((block) => (
              <div
                key={block.slug}
                id={block.slug}
                className="scroll-mt-20 overflow-hidden rounded-card border border-border bg-card"
              >
                <div className="border-b border-border px-6 py-4">
                  <h2 className="text-lg font-semibold text-foreground">{block.feature}</h2>
                </div>
                <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="p-6">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                      <X className="h-3.5 w-3.5 text-danger" />
                      Otros sistemas
                    </p>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                      {block.otros}
                    </p>
                  </div>
                  <div className="bg-accent/40 p-6">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                      <Check className="h-3.5 w-3.5" />
                      Pesito
                    </p>
                    <p className="mt-2.5 text-sm leading-relaxed text-foreground">
                      {block.pesito}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end border-t border-border bg-card px-6 py-3">
                  <Link href="/registro">
                    <Button variant="outline" size="sm">
                      Probar Pesito gratis
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Comparación general, hecha por Pesito. No apunta a una marca puntual.
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
