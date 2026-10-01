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
// scrollRestoration = "manual" del layout raíz. Si la dirección trae un
// ancla (ej. /#precios desde "Comparar planes"), se va a esa sección en
// vez de a 0: sin esto el scroll a 0 pisaba el salto al ancla.
export function ScrollToTopOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    const target = anchor ? document.getElementById(anchor) : null;
    if (target) {
      // Respeta el scroll-margin-top de la sección (queda debajo del navbar).
      target.scrollIntoView({ behavior: "instant", block: "start" });
      return;
    }
    // "instant": el html tiene scroll-behavior smooth (para los anclas) y
    // una animación hasta arriba se corta si la página nueva es más larga.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
