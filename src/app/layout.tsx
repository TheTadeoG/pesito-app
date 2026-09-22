import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Pesito | Sistema de punto de venta para kioscos y almacenes";
const description =
  "Pesito es el sistema de punto de venta, inventario, clientes y caja pensado para kiosqueros y almaceneros de Argentina: simple, rápido y sin vueltas. Empezá gratis.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Pesito",
  },
  description,
  keywords: [
    "sistema para kiosco",
    "punto de venta kiosco",
    "software para almacén",
    "caja registradora digital",
    "sistema POS Argentina",
    "control de stock kiosco",
    "software para kiosqueros",
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
            __html: `try{var t=localStorage.getItem('pesito-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';localStorage.setItem('pesito-theme',t);}document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
