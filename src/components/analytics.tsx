"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

// Google Analytics y Microsoft Clarity, sólo en la web pública. El panel
// (ventas, clientes, plata) nunca se mide ni se graba: Clarity graba pantallas.
// Los IDs vienen de variables de entorno; sin ID, no se carga nada.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

const PUBLIC_PATHS = [
  "/blog",
  "/como-funciona",
  "/comparacion",
  "/comparar-planes",
  "/diccionario",
  "/pesito-para",
  "/preguntas-frecuentes",
  "/privacidad",
  "/terminos",
  "/suscribirse",
];

function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function Analytics() {
  const pathname = usePathname();
  if (!isPublicPath(pathname)) return null;
  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
          <Script id="ga-init" strategy="lazyOnload">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {CLARITY_ID && (
        <Script id="clarity-init" strategy="lazyOnload">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
        </Script>
      )}
    </>
  );
}
