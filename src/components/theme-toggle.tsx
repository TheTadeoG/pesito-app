"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Reads the theme the anti-flash inline script already applied to <html>
    // before hydration, so this one-time sync from the DOM is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.dataset.theme === "dark");
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
