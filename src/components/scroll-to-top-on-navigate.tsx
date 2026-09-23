"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// El navegador puede restaurar solo la posición de scroll al navegar
// (history.scrollRestoration "auto" por defecto), lo que a veces pisa el
// scroll-to-top que hace Next.js en una navegación nueva — sobre todo
// yendo de una página larga (la home, bien scrolleada) a una corta (una
// ficha del diccionario, un artículo del blog), donde se termina viendo
// el final de la página nueva (su CTA) en vez del principio. Se fuerza
// el scroll a 0 en cada cambio de ruta real, sumado al
// scrollRestoration = "manual" del layout raíz.
export function ScrollToTopOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
