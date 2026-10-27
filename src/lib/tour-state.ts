"use client";

import { useSyncExternalStore } from "react";
import { TOUR_STEPS } from "@/lib/tour-steps";

// Dónde va la guía paso a paso. Se guarda en el navegador para que sobreviva a los
// cambios de pantalla (y a un refresh) y se pueda retomar donde se dejó.
const KEY = "pesito-tour";
const EVENT = "pesito-tour-change";

export interface TourState {
  index: number;
}

let cachedRaw: string | null | undefined;
let cachedState: TourState | null = null;

export function readTour(): TourState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedState;
    cachedRaw = raw;
    const parsed = raw ? (JSON.parse(raw) as Partial<TourState>) : null;
    cachedState = parsed && Number.isInteger(parsed.index) && (parsed.index as number) >= 0 ? { index: parsed.index as number } : null;
    return cachedState;
  } catch {
    return null;
  }
}

export function writeTour(index: number) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ index }));
  } catch {
    /* sin almacenamiento: la guía sigue en esta pantalla pero no se retoma */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function startTour() {
  writeTour(0);
}

export function stopTour() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* igual */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useTourState(): TourState | null {
  return useSyncExternalStore(subscribe, readTour, () => null);
}

/** En el paso de la primera venta, el cobro sólo deja elegir efectivo. */
export function tourLocksPayment(): boolean {
  const t = readTour();
  return t !== null && TOUR_STEPS[t.index]?.id === "sale";
}
