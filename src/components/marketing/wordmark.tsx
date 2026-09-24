import { cn } from "@/lib/utils";

// El logo de Pesito lleva el ícono de marca más este wordmark: minúsculas
// en Fredoka Bold (la tipografía redondeada del isotipo) y un punto en el
// acento — dos colores, como una monedita al final del nombre.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-fredoka lowercase tracking-tight text-foreground",
        className
      )}
    >
      pesito<span className="text-primary">.</span>
    </span>
  );
}
