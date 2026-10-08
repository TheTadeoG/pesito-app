"use client";

import { useEffect, useRef, useState, type ComponentType, type HTMLAttributes } from "react";
import { AR, BO, BR, CL, CO, ES, MX, PE, PY, US, UY } from "country-flag-icons/react/3x2";
import { phoneCountries, type PhoneCountry } from "@/lib/phone-countries";

// Las banderas son SVG (no emoji): en Windows los emoji de bandera se ven como
// letras ("AR"), y un <select> nativo no puede mostrar imágenes.
const flags: Record<string, ComponentType<HTMLAttributes<HTMLElement>>> = {
  AR,
  UY,
  CL,
  PY,
  BO,
  BR,
  PE,
  CO,
  MX,
  ES,
  US,
};

function Flag({ code, className }: { code: string; className?: string }) {
  const Icon = flags[code];
  return Icon ? <Icon className={className ?? "h-4 w-6 shrink-0 rounded-[2px]"} aria-hidden="true" /> : null;
}

/** Selector de país para teléfonos: bandera + código, con la lista desplegable. */
export function PhoneCountrySelect({
  value,
  onChange,
  id,
}: {
  value: PhoneCountry;
  onChange: (country: PhoneCountry) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  function openList() {
    setActive(Math.max(0, phoneCountries.findIndex((c) => c.code === value.code)));
    setOpen(true);
  }

  function choose(country: PhoneCountry) {
    onChange(country);
    setOpen(false);
    rootRef.current?.querySelector("button")?.focus();
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(phoneCountries.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(phoneCountries[active]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      // Esc cierra la lista, no la ventana que la contiene.
      if (e.key === "Escape") e.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector("button")?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        id={id}
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        aria-label={`Código de país: ${value.name} ${value.dialCode}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <Flag code={value.code} />
        <span>{value.dialCode}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted-foreground" fill="currentColor" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5-1-1L10 10 6.5 6.5z" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label="Países"
          aria-activedescendant={`phone-country-${phoneCountries[active].code}`}
          onKeyDown={onListKeyDown}
          className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 overflow-auto rounded-xl border border-border bg-card py-1 text-sm shadow-lg outline-none"
        >
          {phoneCountries.map((c, i) => (
            <li
              key={c.code}
              id={`phone-country-${c.code}`}
              role="option"
              aria-selected={c.code === value.code}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(c)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                i === active ? "bg-muted" : ""
              } ${c.code === value.code ? "font-medium text-foreground" : "text-foreground"}`}
            >
              <Flag code={c.code} />
              <span className="flex-1">{c.name}</span>
              <span className="text-muted-foreground">{c.dialCode}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
