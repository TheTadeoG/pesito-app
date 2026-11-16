"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "pesito-admin-blur";

// Desenfoca los datos de los negocios (nombres, dueños, emails, teléfonos, notas e ingresos) para sacar capturas de
// pantalla. Se recuerda en este navegador; el efecto lo da `html[data-admin-blur="1"] .admin-sensitive` (globals.css).
export function PrivacyToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOn(window.localStorage.getItem(KEY) === "1");
    } catch {
      // sin almacenamiento: arranca sin desenfocar
    }
  }, []);

  useEffect(() => {
    if (on) document.documentElement.setAttribute("data-admin-blur", "1");
    else document.documentElement.removeAttribute("data-admin-blur");
    return () => document.documentElement.removeAttribute("data-admin-blur");
  }, [on]);

  function toggle() {
    setOn((v) => {
      try {
        window.localStorage.setItem(KEY, v ? "0" : "1");
      } catch {
        // ignore
      }
      return !v;
    });
  }

  return (
    <Button variant={on ? "primary" : "outline"} size="sm" type="button" onClick={toggle} aria-pressed={on} title="Desenfoca nombres, emails, teléfonos, notas e ingresos para sacar una captura">
      {on ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      <span className="hidden sm:inline">{on ? "Datos ocultos" : "Ocultar datos"}</span>
    </Button>
  );
}
