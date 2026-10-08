"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, HelpCircle, Keyboard, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

function ShortcutGroup({ title, rows }: { title: string; rows: { keys: ReactNode; label: string }[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="divide-y divide-border rounded-xl border border-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-3.5 py-2 text-sm">
            <span className="text-foreground">{row.label}</span>
            <span className="flex shrink-0 items-center gap-1">{row.keys}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Los atajos que existen hoy en el sistema (nav-search, POS, Caja y Compras).
// Si se agrega o se cambia uno, se actualiza esta lista.
function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Atajos del teclado"
      description="Para vender más rápido, sin sacar la mano del teclado."
    >
      <div className="space-y-4">
        <ShortcutGroup
          title="En todo el sistema"
          rows={[
            {
              keys: (
                <>
                  <Kbd>Ctrl</Kbd>
                  <span className="text-xs text-muted-foreground">o</span>
                  <Kbd>⌘</Kbd>
                  <span className="text-xs text-muted-foreground">+</span>
                  <Kbd>K</Kbd>
                </>
              ),
              label: "Buscar y saltar a cualquier pantalla",
            },
          ]}
        />
        <ShortcutGroup
          title="Punto de venta"
          rows={[
            { keys: <Kbd>Escribir o escanear</Kbd>, label: "El cursor va solo al buscador" },
            {
              keys: (
                <>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                </>
              ),
              label: "Elegir un producto de la lista",
            },
            { keys: <Kbd>Enter</Kbd>, label: "Agregar el producto elegido" },
            {
              keys: (
                <>
                  <Kbd>Enter</Kbd>
                  <Kbd>Enter</Kbd>
                </>
              ),
              label: "Cobrar la venta",
            },
          ]}
        />
        <ShortcutGroup
          title="Caja y Compras"
          rows={[
            { keys: <Kbd>Enter</Kbd>, label: "Abrir la caja (en la pantalla de Caja)" },
            {
              keys: (
                <>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <Kbd>Enter</Kbd>
                </>
              ),
              label: "Elegir y agregar un producto en Compras",
            },
          ]}
        />
      </div>
    </Dialog>
  );
}

const itemClass =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

/**
 * Botón de ayuda (?) de la barra de arriba: un menú con los atajos del teclado,
 * el soporte por WhatsApp y las preguntas frecuentes. En el celular no hay
 * atajos (no hay teclado), así que esa opción no se muestra.
 */
export function HelpMenu({ orgName }: { orgName: string }) {
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label="Ayuda"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(open && "border-primary")}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Ayuda"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card py-1.5 shadow-2xl"
        >
          <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ayuda
          </p>
          <button
            type="button"
            role="menuitem"
            className={cn(itemClass, "hidden sm:flex")}
            onClick={() => {
              setOpen(false);
              setShortcuts(true);
            }}
          >
            <Keyboard className="h-4 w-4 text-primary" />
            Atajos del teclado
          </button>
          <a
            role="menuitem"
            className={itemClass}
            href={whatsappLink(`Hola! Soy de ${orgName} y tengo una consulta sobre Pesito.`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <MessageCircle className="h-4 w-4 text-primary" />
            Hablar con soporte
          </a>
          <a
            role="menuitem"
            className={itemClass}
            href="/preguntas-frecuentes"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <BookOpen className="h-4 w-4 text-primary" />
            Preguntas frecuentes
          </a>
        </div>
      )}

      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
    </div>
  );
}
