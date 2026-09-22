"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // The anti-flash inline script only sets data-theme when the visitor
    // already made an explicit choice (stored in localStorage). Without
    // that, the page still renders dark via the prefers-color-scheme media
    // query, so falling back to `dataset.theme === "dark"` alone reads
    // "light" even though the screen is dark — this syncs to what's
    // actually on screen either way.
    const explicit = document.documentElement.dataset.theme;
    const actual =
      explicit === "dark" ||
      (explicit !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(actual);
  }, []);

  function toggle() {
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("pesito-theme", next);
    setIsDark(!isDark);
  }

  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="Cambiar tema">
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
