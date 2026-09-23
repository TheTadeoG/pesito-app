import Link from "next/link";
import {
  ArrowRight,
  Gem,
  Hammer,
  Laptop2,
  PawPrint,
  Pill,
  Sparkles,
  Store,
  Beef,
  Wrench,
} from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { rubroPages } from "@/lib/pesito-para-data";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pesito para tu rubro",
  description:
    "Kiosco, almacén, verdulería, indumentaria y más: Pesito se adapta a cómo vendés de verdad, sea cual sea tu rubro.",
  path: "/pesito-para",
});

// El resto de los rubros que soporta Pesito (ver business-types.ts), sin
// página dedicada todavía — se listan igual porque el sistema ya les
// sirve, aunque no tengan una guía propia con ejemplos puntuales.
const otherRubros = [
  { label: "Farmacia", icon: Pill },
  { label: "Ferretería", icon: Hammer },
  { label: "Petshop", icon: PawPrint },
  { label: "Electrónica", icon: Laptop2 },
  { label: "Artículos de belleza", icon: Sparkles },
  { label: "Accesorios", icon: Gem },
  { label: "Gastronomía", icon: Beef },
  { label: "Servicios", icon: Wrench },
];

export default function PesitoParaPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Rubros que usan Pesito",
    url: `${siteUrl}/pesito-para`,
    itemListElement: rubroPages.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.title,
      url: `${siteUrl}/pesito-para/${r.slug}`,
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
              Pesito sirve para tu rubro, sea cual sea
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              No hicimos un sistema genérico con nombres distintos según a quién se lo vendemos:
              Pesito soporta productos por unidad, por peso y con variantes, así que se adapta a
              cómo vendés de verdad en tu comercio.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {rubroPages.map((rubro) => (
              <Link
                key={rubro.slug}
                href={`/pesito-para/${rubro.slug}`}
                className="group flex items-center justify-between gap-3 rounded-card border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <div>
                  <p className="font-semibold text-foreground">{rubro.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{rubro.intro.slice(0, 90)}…</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>

          <div className="mt-14">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Store className="h-4 w-4 text-muted-foreground" />
              También funciona igual para
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {otherRubros.map((r) => (
                <span
                  key={r.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground"
                >
                  <r.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold">¿No ves tu rubro en la lista?</h2>
            <p className="max-w-md text-primary-foreground/85">
              Igual funciona — probalo gratis y fijate vos mismo.
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
