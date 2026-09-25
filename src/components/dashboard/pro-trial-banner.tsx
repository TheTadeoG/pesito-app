"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProTrialBannerProps {
  /** ISO timestamp de cuándo se apagan las funciones Pro de prueba. */
  proTrialEndsAt: string;
}

interface Remaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
}

function getRemaining(endsAtIso: string): Remaining {
  const totalMs = new Date(endsAtIso).getTime() - Date.now();
  const clamped = Math.max(0, totalMs);
  const days = Math.floor(clamped / (24 * 60 * 60 * 1000));
  const hours = Math.floor((clamped % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((clamped % (60 * 60 * 1000)) / (60 * 1000));
  return { totalMs, days, hours, minutes };
}

const DISMISS_KEY = "pesito-dismissed-pro-trial-expired";

export function ProTrialBanner({ proTrialEndsAt }: ProTrialBannerProps) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [dismissedExpired, setDismissedExpired] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(getRemaining(proTrialEndsAt));
    const id = setInterval(() => setRemaining(getRemaining(proTrialEndsAt)), 60_000);
    return () => clearInterval(id);
  }, [proTrialEndsAt]);

  useEffect(() => {
    try {
      // Se re-muestra cada día: no queremos que alguien la descarte una vez
      // y se olvide para siempre de que la prueba terminó.
      const today = new Date().toDateString();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissedExpired(window.localStorage.getItem(DISMISS_KEY) === today);
    } catch {
      // ignore
    }
  }, []);

  function dismissExpired() {
    setDismissedExpired(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, new Date().toDateString());
    } catch {
      // ignore
    }
  }

  // Evita parpadeo servidor/cliente: no renderizamos nada hasta tener el
  // cálculo hecho en el navegador.
  if (!remaining) return null;

  if (remaining.totalMs <= 0) {
    if (dismissedExpired) return null;
    return (
      <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm sm:mx-6 lg:mx-8">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <p className="min-w-0 flex-1 text-danger">
          Tu prueba de funciones Pro terminó.{" "}
          <Link
            href="/configuracion"
            prefetch={false}
            className="font-semibold underline underline-offset-2"
          >
            Pasate a Pro
          </Link>{" "}
          para volver a tenerlas.
        </p>
        <button
          type="button"
          onClick={dismissExpired}
          aria-label="Descartar aviso"
          title="Descartar aviso"
          className="shrink-0 rounded-full p-1 text-danger/70 hover:bg-black/5 hover:text-danger"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const isLastDay = remaining.totalMs <= 24 * 60 * 60 * 1000;
  const timeLabel =
    remaining.days > 0
      ? `${remaining.days} día${remaining.days !== 1 ? "s" : ""} y ${remaining.hours} hora${remaining.hours !== 1 ? "s" : ""}`
      : remaining.hours > 0
        ? `${remaining.hours} hora${remaining.hours !== 1 ? "s" : ""} y ${remaining.minutes} minuto${remaining.minutes !== 1 ? "s" : ""}`
        : `${remaining.minutes} minuto${remaining.minutes !== 1 ? "s" : ""}`;

  return (
    <div
      className={cn(
        // Ámbar (tono "warning" del sistema), no verde/primary: el resto de
        // la app es verde sobre fondo oscuro, así que un aviso en ese mismo
        // tono se perdía. El último día sube a rojo para la urgencia real.
        "mx-4 mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm sm:mx-6 lg:mx-8",
        isLastDay ? "border-danger/40 bg-danger-bg shadow-danger/10" : "border-warning/40 bg-warning-bg shadow-warning/10"
      )}
    >
      <Sparkles
        className={cn("mt-0.5 h-4 w-4 shrink-0", isLastDay ? "text-danger" : "text-warning")}
      />
      <p className={cn("min-w-0 flex-1", isLastDay ? "text-danger" : "text-warning")}>
        Estás usando funciones del <span className="font-semibold">Plan Pro</span>, de prueba.
        Te quedan <span className="font-semibold">{timeLabel}</span> — después volvés al Plan
        Gratis y las perdés.{" "}
        <Link
          href="/configuracion"
          prefetch={false}
          className="font-semibold underline underline-offset-2"
        >
          Ver planes
        </Link>
      </p>
    </div>
  );
}
