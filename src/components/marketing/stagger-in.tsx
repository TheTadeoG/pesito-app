"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Entrada escalonada de los hijos directos al aparecer en pantalla (300 ms,
// 50 ms entre uno y otro). Se renderiza todo visible: recién con JS se ocultan
// los que todavía no se ven, así sin JS, para los buscadores y con movimiento
// reducido queda el contenido completo.
export function StaggerIn({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pending = Array.from(root.children).filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight
    );
    if (pending.length === 0) return;
    pending.forEach((el) => el.classList.add("stagger-pre"));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => pending.indexOf(a.target) - pending.indexOf(b.target));
        visible.forEach((entry, i) => {
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.style.setProperty("--d", `${i * 50}ms`);
          el.classList.add("stagger-in");
          el.classList.remove("stagger-pre");
          // Al terminar se devuelve el elemento a su estilo normal (p. ej. el hover).
          window.setTimeout(() => {
            el.classList.remove("stagger-in");
            el.style.removeProperty("--d");
          }, 300 + i * 50 + 50);
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    pending.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
