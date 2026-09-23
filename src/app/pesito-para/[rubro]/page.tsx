import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Store } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { rubroPages } from "@/lib/pesito-para-data";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return rubroPages.map((r) => ({ rubro: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rubro: string }>;
}) {
  const { rubro: slug } = await params;
  const rubro = rubroPages.find((r) => r.slug === slug);
  if (!rubro) return {};

  return pageMetadata({
    title: rubro.title,
    description: rubro.intro,
    path: `/pesito-para/${rubro.slug}`,
  });
}

export default async function RubroPage({
  params,
}: {
  params: Promise<{ rubro: string }>;
}) {
  const { rubro: slug } = await params;
  const rubro = rubroPages.find((r) => r.slug === slug);
  if (!rubro) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: rubro.title,
    description: rubro.intro,
    url: `${siteUrl}/pesito-para/${rubro.slug}`,
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
          <Link
            href="/pesito-para"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Store className="h-3.5 w-3.5" />
            Pesito por rubro
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {rubro.title}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{rubro.intro}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {rubro.examples.map((example) => (
              <span
                key={example}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
              >
                {example}
              </span>
            ))}
          </div>

          <section className="mt-14">
            <h2 className="text-xl font-bold text-foreground">
              Lo que se te complica en un {rubro.name}
            </h2>
            <div className="mt-5 space-y-4">
              {rubro.painPoints.map((p) => (
                <div key={p.title} className="rounded-card border border-border bg-card p-5">
                  <p className="font-semibold text-foreground">{p.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14">
            <h2 className="text-xl font-bold text-foreground">Cómo lo resuelve Pesito</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {rubro.features.map((f) => (
                <div key={f.title} className="flex gap-3 rounded-card border border-border bg-card p-5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {f.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14 rounded-card bg-accent/40 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Un día cualquiera
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground">{rubro.dayInLife}</p>
          </section>

          <div className="mt-16 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold">Probá Pesito en tu {rubro.name}</h2>
            <p className="max-w-md text-primary-foreground/85">
              Plan gratis de verdad, sin tarjeta y sin fecha de vencimiento.
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
