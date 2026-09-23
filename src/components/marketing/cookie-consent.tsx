"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { acceptCookieConsent, useCookieBannerVisible } from "@/lib/cookie-consent";

// Tarjetita chica en la esquina en vez de una barra de ancho completo: no
// tapa contenido, no compite con el botón de WhatsApp (queda en la esquina
// opuesta) y no se siente invasivo, sobre todo en celular.
export function CookieConsent() {
  const visible = useCookieBannerVisible();

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-56 rounded-xl border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur sm:bottom-5 sm:left-5">
      <button
        type="button"
        onClick={acceptCookieConsent}
        aria-label="Cerrar aviso de cookies"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="pr-4 leading-relaxed text-muted-foreground">
        Usamos cookies esenciales, sin publicidad ni seguimiento.{" "}
        <Link href="/privacidad" className="text-primary hover:underline">
          Más info
        </Link>
      </p>
    </div>
  );
}
