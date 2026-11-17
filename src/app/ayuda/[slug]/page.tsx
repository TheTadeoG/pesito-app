import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb, MapPin } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { docArticles, docCategories, getDocBySlug } from "@/lib/docs";
import { inlineParts, plainText } from "@/lib/docs/format";
import { planDefinitions } from "@/lib/plan-features";
import { pageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";

export function generateStaticParams() {
  return docArticles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getDocBySlug(slug);
  if (!article) return {};
  return pageMetadata({ title: article.title, description: article.summary, path: `/ayuda/${article.slug}` });
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export default async function AyudaArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getDocBySlug(slug);
  if (!article) notFound();
  const category = docCategories.find((c) => c.id === article.category);
  const related = (article.related ?? []).map((s) => getDocBySlug(s)).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const [y, m, d] = article.updatedAt.split("-");
  const url = `${siteUrl}/ayuda/${article.slug}`;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: article.title,
      description: article.summary,
      inLanguage: "es-AR",
      url,
      dateModified: article.updatedAt,
      step: article.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        text: plainText(s.note ? `${s.text} ${s.note}` : s.text),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Ayuda", item: `${siteUrl}/ayuda` },
        { "@type": "ListItem", position: 2, name: category?.title ?? "Guías", item: `${siteUrl}/ayuda#${article.category}` },
        { "@type": "ListItem", position: 3, name: article.title, item: url },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <nav aria-label="Dónde estás" className="text-sm text-muted-foreground">
            <Link href="/ayuda" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Ayuda
            </Link>
            {category && (
              <>
                {" / "}
                <Link href={`/ayuda#${category.id}`} className="hover:text-foreground">
                  {category.title}
                </Link>
              </>
            )}
          </nav>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{article.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{article.summary}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              <Inline text={article.where} />
            </span>
            {article.plan ? (
              <Link
                href="/comparar-planes"
                className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground hover:brightness-95"
              >
                {`Desde el ${planDefinitions[article.plan].name}`}
              </Link>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">En todos los planes</span>
            )}
          </div>

          {article.before && article.before.length > 0 && (
            <section className="mt-8 rounded-card border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Antes de empezar</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {article.before.map((b) => (
                  <li key={b}>
                    <Inline text={b} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-xl font-bold text-foreground">Paso a paso</h2>
            <ol className="mt-5 space-y-5">
              {article.steps.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="leading-relaxed text-muted-foreground">
                      <Inline text={s.text} />
                    </p>
                    {s.note && (
                      <p className="mt-1 text-sm text-muted-foreground/80">
                        <Inline text={s.note} />
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {article.tips && article.tips.length > 0 && (
            <section className="mt-10 rounded-card bg-accent px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-accent-foreground">
                <Lightbulb className="h-4 w-4" aria-hidden />
                Tené en cuenta
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-accent-foreground">
                {article.tips.map((t) => (
                  <li key={t}>
                    <Inline text={t} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-foreground">Guías relacionadas</h2>
              <ul className="mt-3 space-y-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/ayuda/${r.slug}`} className="text-sm font-medium text-primary hover:underline">
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            ¿Algo no coincide con lo que ves en pantalla? Escribinos a{" "}
            <a href="mailto:soporte@pesito.com.ar" className="font-medium text-primary hover:underline">
              soporte@pesito.com.ar
            </a>
            . <span className="text-xs">{`Guía revisada el ${d}/${m}/${y}.`}</span>
          </p>
        </article>
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
