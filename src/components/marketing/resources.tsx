import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { blogPosts } from "@/lib/blog-data";
import { rubroPages } from "@/lib/pesito-para-data";
import { getDocBySlug } from "@/lib/docs";

// Enlaces de la home a lo que más sirve para aprender y para que los buscadores lleguen: notas del blog, Pesito por rubro y
// guías paso a paso. Se arma con las mismas fuentes de datos que esas páginas (una nota o guía nueva no hay que cargarla acá).
const FEATURED_POSTS = [
  "mejores-sistemas-punto-de-venta-kioscos-argentina",
  "como-controlar-el-fiado",
  "como-controlar-el-stock",
  "arqueo-de-caja-que-es-como-se-hace",
  "como-actualizar-precios-con-inflacion",
  "factura-a-b-c-diferencia",
];
const FEATURED_GUIDES = [
  "como-hacer-una-venta",
  "como-cargar-productos-desde-excel",
  "como-cerrar-la-caja",
  "como-vender-fiado",
  "como-facturar-una-venta",
  "como-hacer-aumentos-masivos-de-precios",
];

export function Resources() {
  const posts = FEATURED_POSTS.map((slug) => blogPosts.find((p) => p.slug === slug)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const guides = FEATURED_GUIDES.map((slug) => getDocBySlug(slug)).filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <section id="recursos" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <h2 className="text-4xl font-extrabold tracking-[-0.035em] text-foreground sm:text-5xl">
          Aprendé a manejar <span className="text-primary">tu negocio</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Notas, guías paso a paso y ejemplos por rubro, para sacarle el jugo a Pesito desde el primer día.
        </p>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Notas del blog</h3>
          <ul className="mt-4 space-y-3">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline">
                  {p.seoTitle ?? p.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/blog" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Ver todas las notas
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground">Pesito por rubro</h3>
          <ul className="mt-4 space-y-3">
            {rubroPages.map((r) => (
              <li key={r.slug}>
                <Link href={`/pesito-para/${r.slug}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/pesito-para" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Ver todos los rubros
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground">Guías paso a paso</h3>
          <ul className="mt-4 space-y-3">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/ayuda/${g.slug}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/ayuda" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Ver todas las guías
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
