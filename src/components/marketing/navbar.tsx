import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnchorLink } from "@/components/marketing/anchor-link";
import { LogoIcon } from "@/components/marketing/logo-icon";
import { Wordmark } from "@/components/marketing/wordmark";
import { InfoMenu } from "@/components/marketing/info-menu";

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
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-foreground"
        >
          <LogoIcon />
          <Wordmark className="text-2xl" />
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
          <InfoMenu />
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm" aria-label="Ingresar">
              <LogIn className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Ingresar</span>
            </Button>
          </Link>
          <Link href="/registro">
            <Button size="sm" className="whitespace-nowrap">
              Empezar gratis
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
