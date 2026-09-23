"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen, Rocket, X } from "lucide-react";

// Aparece una sola vez, justo después de terminar el onboarding — el
// redirect de create_organization manda a "/pos?bienvenida=1" y acá se
// lee ese query param al montar (sólo pasa una vez, en esa navegación
// completa desde el redirect). No usa localStorage: alcanza con leer el
// valor inicial, sin depender del navegador/dispositivo.
export function WelcomeModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(() => searchParams.get("bienvenida") === "1");

  function close() {
    setOpen(false);
    router.replace("/pos");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">¡Bienvenido a Pesito!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Elegí cómo querés arrancar. Podés cambiar de idea cuando quieras.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={close}
            className="flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted"
          >
            <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Empezar a vender ahora
              </span>
              <span className="block text-xs text-muted-foreground">
                Cargá tu primer producto y probá una venta.
              </span>
            </span>
          </button>

          <Link
            href="/como-funciona"
            target="_blank"
            onClick={close}
            className="flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted"
          >
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Ver cómo funciona
              </span>
              <span className="block text-xs text-muted-foreground">
                Los 5 pasos, en una pestaña nueva.
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={close}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Omitir, ya sé cómo funciona
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
