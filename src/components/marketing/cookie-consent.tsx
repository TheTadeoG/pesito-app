"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { acceptCookieConsent, useCookieBannerVisible } from "@/lib/cookie-consent";

export function CookieConsent() {
  const visible = useCookieBannerVisible();

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-muted-foreground">
          Usamos una cookie para mantener tu sesión iniciada y guardamos tu preferencia de tema en
          el navegador. No usamos cookies de publicidad ni de seguimiento entre sitios.{" "}
          <Link href="/privacidad" className="text-primary hover:underline">
            Más info
          </Link>
          .
        </p>
        <Button size="sm" onClick={acceptCookieConsent} className="shrink-0 self-start sm:self-auto">
          Entendido
        </Button>
      </div>
    </div>
  );
}
