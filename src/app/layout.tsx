import type { Metadata } from "next";
import { Fredoka, Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { siteUrl } from "@/lib/utils";
import { ScrollToTopOnNavigate } from "@/components/scroll-to-top-on-navigate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Sólo para la marca (el wordmark "pesito"), no para el resto de la UI —
// ver Wordmark en components/marketing/wordmark.tsx.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  weight: "700",
  subsets: ["latin"],
});

const title = "Pesito | Sistema POS y punto de venta para tu negocio";
const description =
  "Pesito es el sistema POS para negocios de Argentina: cobrá con lector de códigos, controlá stock y caja, anotá el fiado y mirá tus reportes. Empezá gratis.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Pesito",
  },
  description,
  keywords: [
    "sistema de punto de venta para comercios",
    "sistema para kiosco",
    "software para almacén",
    "sistema para negocio de barrio",
    "caja registradora digital",
    "sistema POS Argentina",
    "control de stock para comercios",
  ],
  applicationName: "Pesito",
  authors: [{ name: "Pesito" }],
  robots: { index: true, follow: true },
  // Autoreferencia de idioma/región — no hay otras versiones de idioma
  // del sitio, pero declararlo igual ayuda a buscadores a confirmar que
  // el contenido es en español de Argentina.
  alternates: { canonical: "/", languages: { "es-AR": siteUrl } },
  // Evita que Safari/Chrome mobile conviertan automáticamente números de
  // teléfono, direcciones o emails sueltos del texto en links tocables
  // con su propio estilo — no lo necesitamos en ningún lado del sitio.
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: siteUrl,
    siteName: "Pesito",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      // El script de abajo pone data-theme antes de que React hidrate.
      suppressHydrationWarning
      // Next 16 ya no apaga el "scroll-behavior: smooth" de globals.css al
      // cambiar de página: el salto arriba se animaba y, al volver a la
      // landing desde una página scrolleada, se cortaba a mitad de camino
      // (quedaba abajo). Con esto Next lo apaga durante la navegación; los
      // anclas (#precios, etc.) siguen siendo suaves.
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{history.scrollRestoration='manual';}catch(e){}try{var t=localStorage.getItem('pesito-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';localStorage.setItem('pesito-theme',t);}document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ScrollToTopOnNavigate />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
