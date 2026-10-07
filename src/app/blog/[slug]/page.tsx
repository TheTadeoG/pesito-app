import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { blogAuthor, blogPosts } from "@/lib/blog-data";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return {};

  return pageMetadata({
    title: post.seoTitle ?? post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
  });
}

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: "es-AR",
    url: `${siteUrl}/blog/${post.slug}`,
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
    author: {
      "@type": "Person",
      name: blogAuthor.name,
      worksFor: { "@type": "Organization", name: "Pesito", url: siteUrl },
    },
    publisher: { "@type": "Organization", name: "Pesito" },
  };

  const faqData = post.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: "es-AR",
        mainEntity: post.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }
    : null;
  const rankingData = post.ranking?.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: post.title,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: post.ranking.length,
        itemListElement: post.ranking.map((name, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name,
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {faqData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
        />
      )}
      {rankingData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(rankingData) }}
        />
      )}
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al blog
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {`Por ${blogAuthor.name}, ${blogAuthor.role}`}
            </span>
            <time dateTime={post.publishedAt}>{formatLongDate(post.publishedAt)}</time>
            {post.updatedAt && post.updatedAt !== post.publishedAt && (
              <span>
                {"Actualizado el "}
                <time dateTime={post.updatedAt}>{formatLongDate(post.updatedAt)}</time>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readingMinutes} min de lectura
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {post.title}
          </h1>

          {post.quickAnswer && (
            <div className="mt-6 rounded-card border border-primary/30 bg-accent px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">
                Respuesta corta
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{post.quickAnswer}</p>
            </div>
          )}

          <div className="prose-pesito mt-10 space-y-8">
            {post.sections.map((section, i) => (
              <section key={section.heading ?? i}>
                {section.heading && (
                  <h2 className="text-xl font-bold text-foreground">{section.heading}</h2>
                )}
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((p, j) => (
                    <p key={j} className="text-sm leading-relaxed text-muted-foreground">
                      {p}
                    </p>
                  ))}
                </div>
                {section.list && (
                  <ul className="mt-3 space-y-2">
                    {section.list.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span
                          aria-hidden
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {section.table && (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[34rem] text-left text-xs sm:text-sm">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          {section.table.headers.map((h) => (
                            <th key={h} scope="col" className="px-3 py-2 font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row) => (
                          <tr key={row[0]} className="border-t border-border">
                            {row.map((cell, c) => (
                              <td
                                key={c}
                                className={c === 0 ? "px-3 py-2 font-semibold text-foreground" : "px-3 py-2 text-muted-foreground"}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>

          {post.faqs && post.faqs.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold text-foreground">Preguntas frecuentes</h2>
              <div className="mt-4 space-y-5">
                {post.faqs.map((f) => (
                  <div key={f.question}>
                    <h3 className="text-base font-semibold text-foreground">{f.question}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-16 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold">Empezá a usar Pesito gratis</h2>
            <p className="max-w-md text-primary-foreground/85">
              Sin tarjeta, sin fecha de vencimiento en el plan gratis.
            </p>
            <Link href="/registro">
              <Button size="lg" variant="onColor">
                Empezar gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </article>
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
