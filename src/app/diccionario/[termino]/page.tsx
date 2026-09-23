import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { glossaryCategories, findGlossaryTerm } from "@/lib/diccionario-data";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return glossaryCategories.flatMap((c) => c.terms.map((t) => ({ termino: t.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ termino: string }>;
}) {
  const { termino } = await params;
  const found = findGlossaryTerm(termino);
  if (!found) return {};

  return pageMetadata({
    title: `¿Qué es ${found.term.term}? — Diccionario Pesito`,
    description: found.term.definition,
    path: `/diccionario/${found.term.slug}`,
  });
}

export default async function TerminoPage({
  params,
}: {
  params: Promise<{ termino: string }>;
}) {
  const { termino } = await params;
  const found = findGlossaryTerm(termino);
  if (!found) notFound();
  const { category, term } = found;

  const otherTerms = category.terms.filter((t) => t.slug !== term.slug);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term.term,
    description: term.definition,
    url: `${siteUrl}/diccionario/${term.slug}`,
    inDefinedTermSet: `${siteUrl}/diccionario`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Link
            href="/diccionario"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Diccionario completo
          </Link>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            {category.title}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {term.term}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{term.definition}</p>

          {term.pesito && (
            <p className="mt-6 rounded-card bg-accent px-5 py-4 text-sm font-medium text-accent-foreground">
              {term.pesito}
            </p>
          )}

          <div className="mt-14 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold">Llevá todo esto en un solo sistema</h2>
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

          {otherTerms.length > 0 && (
            <section className="mt-16">
              <h2 className="text-lg font-semibold text-foreground">
                Más términos de {category.title.toLowerCase()}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {otherTerms.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/diccionario/${t.slug}`}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {t.term}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
