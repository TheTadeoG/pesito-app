import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const title = "Pesito | Sistema de punto de venta para el comercio de barrio";
const description =
  "Pesito es el sistema de punto de venta, inventario, clientes y caja pensado para comerciantes de barrio de cualquier rubro en Argentina: simple, rápido y sin vueltas. Empezá gratis.";

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
  alternates: { canonical: "/" },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
