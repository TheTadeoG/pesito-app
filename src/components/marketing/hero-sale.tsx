"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Avisa a los costados de la portada (hero-sides.tsx) cuando en el panel se
// cobra la venta de ejemplo, para que los nodos se enciendan en ese momento.
const SaleContext = createContext<{ fire: number; trigger: () => void }>({ fire: 0, trigger: () => {} });

export function SaleProvider({ children }: { children: ReactNode }) {
  const [fire, setFire] = useState(0);
  const trigger = useCallback(() => setFire((f) => f + 1), []);
  const value = useMemo(() => ({ fire, trigger }), [fire, trigger]);
  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

export const useSale = () => useContext(SaleContext);
