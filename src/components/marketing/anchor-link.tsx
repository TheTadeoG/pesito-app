"use client";

import { AnchorHTMLAttributes, ReactNode } from "react";

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
export function AnchorLink({ href, children, onClick, ...props }: AnchorLinkProps) {
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

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
