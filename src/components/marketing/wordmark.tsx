import { cn } from "@/lib/utils";

// El logo de Pesito lleva el ícono (billete en un cuadrado verde) más este
// wordmark: minúsculas en negrita y un punto en el acento — dos colores,
// como una monedita al final del nombre.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold lowercase tracking-tight text-foreground", className)}>
      pesito<span className="text-primary">.</span>
    </span>
  );
}
