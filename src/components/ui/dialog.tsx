"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogSize = "md" | "lg";

// Ventanas abiertas, en orden: con Esc se cierra sólo la de arriba.
const openDialogs: symbol[] = [];

const sizeClasses: Record<DialogSize, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: DialogSize;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: DialogProps) {
  // Portal a document.body: si no, el fondo semitransparente queda anidado
  // adentro del árbol de quien abre el diálogo (ej. el sidebar), y algunos
  // navegadores pintan un header con "sticky" + blur por encima igual,
  // aunque tenga menor z-index — se ve como si el header no se oscureciera.
  // open sólo se vuelve true por una interacción del usuario (nunca en el
  // render inicial del servidor), así que document ya existe acá.
  const idRef = useRef<symbol | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Esc cierra la ventana de arriba. Si un campo ya usó la tecla (cerrar una lista
  // de sugerencias), no se cierra además la ventana.
  useEffect(() => {
    if (!open) return;
    const id = Symbol("dialog");
    idRef.current = id;
    openDialogs.push(id);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (openDialogs[openDialogs.length - 1] !== id) return;
      e.preventDefault();
      onCloseRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      const i = openDialogs.indexOf(id);
      if (i >= 0) openDialogs.splice(i, 1);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div data-dialog="open" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto rounded-card border border-border bg-card p-6 shadow-2xl",
          sizeClasses[size],
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
