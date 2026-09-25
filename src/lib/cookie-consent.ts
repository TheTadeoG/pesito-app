"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export const COOKIE_CONSENT_KEY = "pesito-cookie-consent";
const COOKIE_CONSENT_EVENT = "pesito-cookie-consent-changed";

// Páginas de adentro del sistema (ya logueado): quien llegó hasta ahí ya
// aceptó al crear la cuenta, mostrar el cartel ahí sería molesto. Se
// excluye por prefijo (lista acotada) en vez de listar cada página
// pública nueva, que sigue creciendo. Al sumar una pantalla al panel,
// agregarla acá (si no, el cartel aparece tapando el menú lateral).
const HIDDEN_PREFIXES = [
  "/pos",
  "/en-vivo",
  "/caja",
  "/clientes",
  "/compras",
  "/configuracion",
  "/inventario",
  "/marcas",
  "/productos",
  "/proveedores",
  "/recomendaciones",
  "/reportes",
  "/soporte",
  "/usuarios",
  "/baja-rotacion",
  "/onboarding",
  "/admin",
  "/auth",
];

function isCookieBannerRoute(pathname: string) {
  return !HIDDEN_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function readDismissed() {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function acceptCookieConsent() {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "1");
  } catch {
    // Sin localStorage no hay dónde guardar la elección — el cartel se
    // cierra igual para esta visita, va a volver a aparecer en la próxima.
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

// La usan tanto el cartel de cookies como el botón flotante de WhatsApp:
// éste necesita correrse hacia arriba mientras el cartel ocupa la
// esquina inferior, así que ambos comparten la misma noción de "¿está
// visible ahora?" — con un evento propio para que el botón se entere en
// el momento (mismo tab) cuando el cartel se cierra, no recién en la
// próxima navegación.
export function useCookieBannerVisible() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
    function onChange() {
      setDismissed(readDismissed());
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
  }, []);

  return !dismissed && isCookieBannerRoute(pathname);
}
