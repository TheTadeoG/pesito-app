import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { DocsSearch } from "@/components/docs/docs-search";
import { docArticles, docCategories, docsInCategory, docsLastUpdated } from "@/lib/docs";
import { planDefinitions } from "@/lib/plan-features";
import { allFaqs } from "@/lib/faq-data";
import { pageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";

export const metadata = pageMetadata({
  title: "Ayuda de Pesito: guías paso a paso para cada tarea",
  description:
    "Cómo vender, cobrar, abrir y cerrar la caja, cargar productos, controlar el stock, registrar compras y más. Guías paso a paso con buscador.",
  path: "/ayuda",
});

// Dudas generales que la gente trae antes de buscar una guía: salen de la fuente única de preguntas (faq-data).
const QUICK_QUESTIONS = [
  "¿Pesito es gratis?",
  "¿Necesito internet para usar Pesito?",
  "¿Imprime tickets? ¿Hace factura electrónica?",
  "¿Cada empleado tiene su propia caja?",
];
const quickFaqs = QUICK_QUESTIONS.map((q) => allFaqs.find((f) => f.question === q)).filter((f): f is NonNullable<typeof f> => Boolean(f));

export default function AyudaPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Ayuda de Pesito",
    description: metadata.description,
    url: `${siteUrl}/ayuda`,
    inLanguage: "es-AR",
    hasPart: docArticles.map((a) => ({ "@type": "HowTo", name: a.title, url: `${siteUrl}/ayuda/${a.slug}` })),
  };
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Guías de ayuda de Pesito",
    numberOfItems: docArticles.length,
    itemListElement: docArticles.map((a, i) => ({ "@type": "ListItem", position: i + 1, name: a.title, url: `${siteUrl}/ayuda/${a.slug}` })),
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "es-AR",
    mainEntity: quickFaqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Pesito", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ayuda", item: `${siteUrl}/ayuda` },
    ],
  };
  const [lastY, lastM, lastD] = docsLastUpdated().split("-");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([structuredData, itemList, faqLd, breadcrumb]) }} />
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <LifeBuoy className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">¿En qué te ayudamos?</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Guías paso a paso para cada cosa que podés hacer en Pesito. Escribí lo que querés hacer y te mostramos cómo.
          </p>

          <div className="mt-8">
            <DocsSearch
              articles={docArticles}
            >
              <nav className="flex flex-wrap gap-2" aria-label="Categorías">
                {docCategories.map((cat) => (
                  <a
                    key={cat.id}
                    href={`#${cat.id}`}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {cat.title}
                  </a>
                ))}
              </nav>

              <div className="mt-10 space-y-12">
                {docCategories.map((cat) => {
                  const list = docsInCategory(cat.id);
                  if (list.length === 0) return null;
                  return (
                    <section key={cat.id} id={cat.id} className="scroll-mt-20">
                      <h2 className="text-xl font-bold text-foreground">{cat.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {list.map((a) => (
                          <li key={a.slug}>
                            <Link
                              href={`/ayuda/${a.slug}`}
                              className="block h-full rounded-card border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/40"
                            >
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-foreground">{a.title}</span>
                                {a.plan && (
                                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                                    {planDefinitions[a.plan].name}
                                  </span>
                                )}
                              </span>
                              <span className="mt-1 block text-sm text-muted-foreground">{a.summary}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </DocsSearch>
          </div>

          {quickFaqs.length > 0 && (
            <section className="mt-16">
              <h2 className="text-xl font-bold text-foreground">Dudas rápidas antes de empezar</h2>
              <div className="mt-4 divide-y divide-border rounded-card border border-border">
                {quickFaqs.map((f) => (
                  <div key={f.question} className="px-5 py-4">
                    <h3 className="text-base font-semibold text-foreground">{f.question}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-16 rounded-card border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">¿No encontraste lo que buscabas?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Escribinos a{" "}
              <a href="mailto:soporte@pesito.com.ar" className="font-medium text-primary hover:underline">
                soporte@pesito.com.ar
              </a>{" "}
              y te respondemos. También podés mirar las{" "}
              <Link href="/preguntas-frecuentes" className="font-medium text-primary hover:underline">
                preguntas frecuentes
              </Link>
              .
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{`Guías revisadas por última vez el ${lastD}/${lastM}/${lastY}.`}</p>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
