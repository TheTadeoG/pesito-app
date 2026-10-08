"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Al cambiar de tema: el ícono gira y se funde (sol ↔ luna) y toda la pantalla
// hace un fundido suave (View Transitions; ver globals.css). Se usa a lo sumo
// unas pocas veces por sesión, así que una animación corta no estorba. Con
// movimiento reducido o en navegadores sin View Transitions, el cambio es directo.
export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // The anti-flash inline script in <head> always sets an explicit
    // data-theme (locking in the OS preference on first visit and reusing
    // it on every later load), so this just reads what's already applied.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = isDark ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && typeof document.startViewTransition === "function") {
      document.startViewTransition(apply);
    } else {
      apply();
    }
    window.localStorage.setItem("pesito-theme", next);
    setIsDark(!isDark);
  }

  return { isDark, toggle };
}

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  const icon =
    "absolute inset-0 h-4 w-4 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";

  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="Cambiar tema">
      <span className="relative block h-4 w-4" aria-hidden="true">
        <Sun className={`${icon} ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"}`} />
        <Moon className={`${icon} ${isDark ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      </span>
    </Button>
  );
}

/** El mismo cambio de tema, como una fila del menú del celular. */
export function ThemeMenuItem({ className }: { className?: string }) {
  const { isDark, toggle } = useTheme();
  const Icon = isDark ? Sun : Moon;
  return (
    <button type="button" onClick={toggle} className={className}>
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left">{isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}</span>
    </button>
  );
}
