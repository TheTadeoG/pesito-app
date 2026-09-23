import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { glossaryCategories } from "@/lib/diccionario-data";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Diccionario de términos de punto de venta y comercio",
  description:
    "Qué es una factura A, B o C, qué es el CAE, qué es fiado, arqueo de caja, margen y más de 20 términos de venta, stock y facturación explicados en criollo.",
  path: "/diccionario",
});

export default function DiccionarioPage() {
  const allTerms = glossaryCategories.flatMap((c) => c.terms);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Diccionario de Pesito",
    description: metadata.description,
    url: `${siteUrl}/diccionario`,
    hasDefinedTerm: allTerms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.definition,
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
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <BookOpen className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Diccionario del comercio: términos de venta, stock y facturación
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Los términos que más se escuchan atrás de un mostrador, explicados sin vueltas —
            sirvan o no para tu rubro puntual.
          </p>

          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Categorías">
            {glossaryCategories.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {cat.title}
              </a>
            ))}
          </nav>

          <div className="mt-12 space-y-14">
            {glossaryCategories.map((cat) => (
              <section key={cat.id} id={cat.id} className="scroll-mt-20">
                <h2 className="text-xl font-bold text-foreground">{cat.title}</h2>
                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  {cat.terms.map((t) => (
                    <div
                      key={t.slug}
                      id={t.slug}
                      className="scroll-mt-20 rounded-card border border-border bg-card p-5"
                    >
                      <dt className="font-semibold text-foreground">{t.term}</dt>
                      <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {t.definition}
                      </dd>
                      {t.pesito && (
                        <dd className="mt-2.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground">
                          {t.pesito}
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold">¿Y si probás llevar todo esto en un solo lugar?</h2>
            <p className="max-w-md text-primary-foreground/85">
              Ventas, stock, fiado y caja, sin cuaderno ni planillas sueltas.
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
