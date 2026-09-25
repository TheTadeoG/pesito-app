"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { consumePendingSale } from "@/lib/cash-events";

// Después de cobrar en el POS no se refresca nada (re-renderizaría todo el
// catálogo). Al salir del POS, la primera página que se abre puede venir del
// caché del navegador sin esa venta: acá se la refresca una vez.
export function RefreshAfterSale() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname.startsWith("/pos")) return;
    if (consumePendingSale()) router.refresh();
  }, [pathname, router]);

  return null;
}
