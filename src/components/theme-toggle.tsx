"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
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
