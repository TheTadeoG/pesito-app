"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  trigger: ReactNode;
  align?: "left" | "right";
  children: ReactNode;
}

// El menú se posiciona "fixed" respecto de la pantalla (no absolute dentro
// del contenedor): así no lo recorta una tabla con overflow ni le agrega
// una barra de scroll, y si no entra abajo del botón se abre hacia arriba.
export function DropdownMenu({ trigger, align = "right", children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ubica el menú pegado al botón: abajo si entra, si no arriba.
  const place = useCallback(() => {
    if (!ref.current || !menuRef.current) return;
    const trigger = ref.current.getBoundingClientRect();
    const menuHeight = menuRef.current.offsetHeight;
    const gap = 4;
    const fitsBelow = trigger.bottom + gap + menuHeight <= window.innerHeight;
    const next: CSSProperties = fitsBelow
      ? { top: trigger.bottom + gap }
      : { bottom: window.innerHeight - trigger.top + gap };
    if (align === "right") next.right = window.innerWidth - trigger.right;
    else next.left = trigger.left;
    setPosition(next);
  }, [align]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    // Si la página o la tabla se mueven (scroll, también el horizontal que
    // hace el navegador al enfocar el botón), el menú acompaña al botón.
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  return (
    <div ref={ref} className="relative inline-block">
      <div
        onClick={() => {
          setPosition(null);
          setOpen((v) => !v);
        }}
      >
        {trigger}
      </div>
      {open && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[200px] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
          // Hasta medir, invisible (evita un parpadeo en la posición vieja).
          style={position ?? { top: 0, left: 0, visibility: "hidden" }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Como DropdownMenu, pero pensado para alojar controles interactivos
// (selects, checkboxes) en vez de una lista de acciones: a diferencia de
// DropdownMenu, un click adentro NO lo cierra — sólo clickear afuera.
export function FilterPanel({ trigger, align = "right", children }: DropdownMenuProps) {
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
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-30 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  onClick,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none",
        danger ? "text-danger" : "text-foreground"
      )}
    >
      {children}
    </button>
  );
}
