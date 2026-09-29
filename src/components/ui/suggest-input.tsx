"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MAX_OPTIONS = 8;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Campo de texto con sugerencias (para filtrar eligiendo de una lista). Reemplaza
 * al `datalist` del navegador, que se dibuja con el estilo del sistema y no
 * combina con el resto. Se escribe para filtrar; con flechas y Enter o con un
 * clic se elige una sugerencia.
 */
export function SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  ariaLabel: string;
  /** Clases del campo (por ejemplo el espacio para un ícono a la izquierda). */
  className?: string;
}) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const suggestions = useMemo(() => {
    const q = normalize(value.trim());
    const matches = q ? options.filter((option) => normalize(option).includes(q)) : options;
    // Si lo escrito ya es exactamente una opción, no hace falta ofrecerla de nuevo.
    return matches.filter((option) => option !== value).slice(0, MAX_OPTIONS);
  }, [options, value]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((current) => (suggestions.length === 0 ? -1 : (current + 1) % suggestions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((current) =>
        suggestions.length === 0 ? -1 : (current <= 0 ? suggestions.length : current) - 1
      );
    } else if (e.key === "Enter" && open && active >= 0 && suggestions[active]) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && suggestions.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20",
          className
        )}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((option, index) => (
            <li
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown (no click): el campo no debe perder el foco antes de elegir.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "cursor-pointer truncate px-3.5 py-2 text-sm text-foreground",
                index === active ? "bg-muted" : "hover:bg-muted"
              )}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
