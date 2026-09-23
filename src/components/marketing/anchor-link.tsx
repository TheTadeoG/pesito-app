"use client";

import { AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Altura aprox. del navbar sticky + un margen, para que la sección no
// quede tapada al hacer scroll hasta el anchor.
const SCROLL_OFFSET = 80;

interface AnchorLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: `#${string}`;
  children: ReactNode;
}

// Reemplaza el salto instantáneo del navegador al click en un ancla (#id)
// por un scroll suave y con offset, sin depender del soporte de
// `scroll-behavior: smooth` del navegador del usuario.
export function AnchorLink({ href, children, onClick, className, ...props }: AnchorLinkProps) {
  const pathname = usePathname();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;

    const target = document.getElementById(href.slice(1));
    if (!target) return;

    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
    history.pushState(null, "", href);
  }

  // El anchor sólo existe en la home: si estamos en otra página (ej.
  // /como-funciona), un <a href="#precios"> no encuentra el id y se queda
  // ahí sin hacer nada. Navegamos a "/" + el hash en vez de intentar un
  // scroll que no tiene destino.
  if (pathname !== "/") {
    return (
      <Link href={`/${href}`} className={className} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}
