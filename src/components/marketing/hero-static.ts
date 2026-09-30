"use client";

import { useEffect, useState } from "react";

// Sólo para comparar en el preview: con `?hero=fijo` la portada se ve sin
// animación (panel ya cobrado, costados con puntos fijos en las líneas).
export function useStaticHero() {
  const [fixed, setFixed] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(
      () => setFixed(new URLSearchParams(window.location.search).get("hero") === "fijo"),
      0
    );
    return () => window.clearTimeout(id);
  }, []);
  return fixed;
}
