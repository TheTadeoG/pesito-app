"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { navSections } from "@/lib/nav";
import { NAV_SHORTCUTS, digitFromCode } from "@/lib/shortcuts";
import { useShortcutHints } from "@/lib/shortcut-hints";

// Buscador del menú ("Buscar o ir a…", Ctrl/⌘ + K): lleva a cualquier
// pantalla escribiendo parte del nombre. Enter abre la primera coincidencia.
export function NavSearch({
  canSeeAdminItems,
  hasCashRegister,
}: {
  canSeeAdminItems: boolean;
  hasCashRegister: boolean;
}) {
  const router = useRouter();
  const showHints = useShortcutHints();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const destinations = useMemo(
    () =>
      navSections.flatMap((section) =>
        section.items
          .filter((item) => !item.adminOnly || canSeeAdminItems)
          .map((item) => ({ ...item, group: section.title }))
      ),
    [canSeeAdminItems]
  );

  const q = query.trim().toLowerCase();
  const results = q
    ? destinations.filter(
        (d) => d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q)
      )
    : destinations;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      // Alt (⌥ en Mac) + número: ir a una pantalla. No con una ventana abierta
      // (se perdería lo que se está cargando).
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.repeat) {
        const digit = digitFromCode(e.code);
        const target = digit ? NAV_SHORTCUTS.find((s) => s.digit === digit) : undefined;
        if (!target || document.querySelector('[data-dialog="open"]')) return;
        e.preventDefault();
        router.push(target.href);
      }
    }
    // Apretar y soltar Alt solo hace que Windows (Chrome, Brave, Edge) pase el foco al
    // menú del navegador y lo abra: en el cobro, esa tecla "se iba" del sistema.
    // Cancelar el Alt solo evita eso. Alt + otra tecla (los atajos) no se afecta.
    function onAltAlone(e: KeyboardEvent) {
      if (e.key === "Alt" && !e.ctrlKey && !e.metaKey && !e.shiftKey) e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onAltAlone);
    window.addEventListener("keyup", onAltAlone);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onAltAlone);
      window.removeEventListener("keyup", onAltAlone);
    };
  }, [router]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl bg-muted px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1">Buscar o ir a…</span>
        {showHints && (
          <kbd className="rounded-md border border-border bg-card px-1.5 text-[10px] font-medium">Ctrl K</kbd>
        )}
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        title="Ir a…"
        description={hasCashRegister ? "Escribí el nombre de una pantalla." : "Escribí el nombre de una pantalla. Tu caja está cerrada."}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (results[0]) go(results[0].href);
          }}
        >
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: proveedores, caja, qué comprar…"
              aria-label="Buscar una pantalla"
              className="pl-10"
            />
          </div>
        </form>
        <div className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No encontramos esa pantalla.</p>
          )}
          {results.map((d, i) => (
            <button
              key={d.href}
              type="button"
              onClick={() => go(d.href)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
            >
              <d.icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 font-medium text-foreground">{d.label}</span>
              <span className="text-xs text-muted-foreground">{i === 0 && q ? `${d.group} · Enter` : d.group}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
