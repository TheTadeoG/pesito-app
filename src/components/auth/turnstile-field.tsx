"use client";

import { useEffect, useRef } from "react";

// CAPTCHA de Cloudflare Turnstile (gratis). Se muestra sólo cuando el servidor lo
// pide (una IP que está forzando el login o el registro). Dentro de un <form>,
// Turnstile agrega solo el campo oculto "cf-turnstile-response" con el token.
// Si no hay clave pública configurada, no muestra nada.

interface TurnstileApi {
  render: (element: HTMLElement, options: { sitekey: string; theme?: "auto" | "light" | "dark" }) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(onReady: () => void): () => void {
  if (window.turnstile) {
    onReady();
    return () => {};
  }
  let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
  if (!script) {
    script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "1";
    document.head.appendChild(script);
  }
  script.addEventListener("load", onReady);
  return () => script?.removeEventListener("load", onReady);
}

/** `resetSignal`: cualquier valor que cambie después de cada envío (el token se usa una sola vez). */
export function TurnstileField({ resetSignal }: { resetSignal?: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || widgetId.current || !container.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(container.current, { sitekey: siteKey, theme: "auto" });
    };
    const stopListening = loadScript(render);
    return () => {
      cancelled = true;
      stopListening();
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetSignal]);

  if (!siteKey) return null;
  return <div ref={container} className="flex justify-center" />;
}
