"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Avisa a los costados de la portada (hero-sides.tsx) cuando el panel empieza la
// venta de ejemplo (los avisos se ocultan) y cuando la cobra (los nodos se encienden).
const SaleContext = createContext<{ begin: number; fire: number; start: () => void; trigger: () => void }>({
  begin: 0,
  fire: 0,
  start: () => {},
  trigger: () => {},
});

export function SaleProvider({ children }: { children: ReactNode }) {
  const [begin, setBegin] = useState(0);
  const [fire, setFire] = useState(0);
  const start = useCallback(() => setBegin((b) => b + 1), []);
  const trigger = useCallback(() => setFire((f) => f + 1), []);
  const value = useMemo(() => ({ begin, fire, start, trigger }), [begin, fire, start, trigger]);
  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

export const useSale = () => useContext(SaleContext);
