"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const infoLinks = [
  { href: "/como-funciona", label: "Cómo funciona (los 5 pasos)" },
  { href: "/comparacion", label: "Comparación con otros sistemas" },
  { href: "/diccionario", label: "Diccionario de términos" },
  { href: "/pesito-para", label: "Pesito por rubro" },
  { href: "/blog", label: "Blog" },
  { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
];

// Dropdown de navegación (no de acción, como el DropdownMenu de /ui): son
// links, así que usa <Link> y cierra al hacer click afuera o en un ítem.
export function InfoMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        Recursos
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-3 min-w-[250px] overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-lg">
          {infoLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
