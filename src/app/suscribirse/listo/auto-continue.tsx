"use client";

import { useEffect } from "react";

// Con el pago confirmado, sigue solo a Pesito. Carga completa (no
// router.push): las pantallas guardadas en caché tienen el plan viejo.
export function AutoContinue({ href, seconds = 3 }: { href: string; seconds?: number }) {
  useEffect(() => {
    const id = window.setTimeout(() => window.location.assign(href), seconds * 1000);
    return () => window.clearTimeout(id);
  }, [href, seconds]);
  return null;
}
