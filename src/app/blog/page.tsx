import Link from "next/link";
import { ArrowRight, Clock, Newspaper } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { blogPosts } from "@/lib/blog-data";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Blog",
  description:
    "Guías prácticas para el comercio de barrio: listas de precios, arqueo de caja, facturación y cómo elegir un sistema de punto de venta.",
  path: "/blog",
});

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

export default function BlogPage() {
  const posts = [...blogPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Newspaper className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Guías para el comercio de barrio
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Precios, caja, facturación y las decisiones del día a día de llevar un negocio — sin
            vueltas técnicas de más.
          </p>

          <div className="mt-12 space-y-5">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block rounded-card border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <time dateTime={post.publishedAt}>{formatLongDate(post.publishedAt)}</time>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.readingMinutes} min de lectura
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-foreground group-hover:text-primary">
                  {post.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {post.excerpt}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Leer
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
