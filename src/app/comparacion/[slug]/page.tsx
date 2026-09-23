import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { comparisonBlocks } from "@/lib/comparacion-data";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return comparisonBlocks.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const block = comparisonBlocks.find((b) => b.slug === slug);
  if (!block) return {};

  return pageMetadata({
    title: `${block.feature}: Pesito vs. otros sistemas`,
    description: block.pesito,
    path: `/comparacion/${block.slug}`,
  });
}

export default async function ComparacionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const block = comparisonBlocks.find((b) => b.slug === slug);
  if (!block) notFound();

  const otherBlocks = comparisonBlocks.filter((b) => b.slug !== block.slug);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${block.feature}: Pesito vs. otros sistemas`,
    description: block.pesito,
    url: `${siteUrl}/comparacion/${block.slug}`,
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
            href="/comparacion"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Ver comparación completa
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {block.feature}: Pesito frente a otros sistemas
          </h1>

          <div className="mt-10 overflow-hidden rounded-card border border-border bg-card">
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
                <p className="mt-2.5 text-sm leading-relaxed text-foreground">{block.pesito}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
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

          <section className="mt-16">
            <h2 className="text-lg font-semibold text-foreground">Otras comparaciones</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {otherBlocks.map((b) => (
                <Link
                  key={b.slug}
                  href={`/comparacion/${b.slug}`}
                  className="rounded-card border border-border bg-card p-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {b.feature}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
