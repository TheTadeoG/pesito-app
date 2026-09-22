import Link from "next/link";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnchorLink } from "@/components/marketing/anchor-link";

const links = [
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#precios", label: "Precios" },
  { href: "#preguntas-frecuentes", label: "Preguntas" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Banknote className="h-5 w-5" />
          </span>
          <span className="text-lg">Pesito</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {links.map((link) => (
            <AnchorLink
              key={link.href}
              href={link.href as `#${string}`}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </AnchorLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Ingresar
            </Button>
          </Link>
          <Link href="/registro">
            <Button size="sm">Empezar gratis</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
