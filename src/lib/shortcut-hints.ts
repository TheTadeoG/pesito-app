"use client";

import { useSyncExternalStore } from "react";

// Mostrar o no las teclas de atajo en los botones (insignias "1", "P", "Ctrl K",
// "(Enter)"). Por defecto ocultas. Se guarda por dispositivo: la caja con teclado las quiere ver, una
// tablet o un celular no. Los atajos funcionan igual con las insignias ocultas.
const KEY = "pesito-shortcut-hints";
const EVENT = "pesito-shortcut-hints-change";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setShortcutHints(show: boolean) {
  try {
    window.localStorage.setItem(KEY, show ? "on" : "off");
  } catch {
    // sin almacenamiento: el cambio vale sólo hasta recargar
  }
  window.dispatchEvent(new Event(EVENT));
}

/** true = mostrar las insignias (por defecto están ocultas). */
export function useShortcutHints(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
