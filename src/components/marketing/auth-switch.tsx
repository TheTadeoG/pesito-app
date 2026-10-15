"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// La landing es estática (rápida y cacheable): no lee la sesión en el
// servidor. Acá se mira en el navegador si hay cookie de sesión de Supabase
// (sb-<proyecto>-auth-token, a veces en trozos) y se cambia el botón. Sin
// sesión, y en el servidor, se ve siempre lo mismo que ven Google y las IA.
// Sólo dice que hay una sesión: si ya venció, el panel manda a /login.
const subscribe = () => () => {};
const hasSession = () => /(?:^|;\s*)sb-[^=;]+-auth-token/.test(document.cookie);

export function AuthSwitch({ guest, member }: { guest: ReactNode; member: ReactNode }) {
  const loggedIn = useSyncExternalStore(subscribe, hasSession, () => false);
  return <>{loggedIn ? member : guest}</>;
}
