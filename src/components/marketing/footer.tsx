import Link from "next/link";
import { Banknote } from "lucide-react";
import { AnchorLink } from "@/components/marketing/anchor-link";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Banknote className="h-4 w-4" />
          </span>
          Pesito
        </Link>

        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Pesito. Hecho para kiosqueros y almaceneros.
        </p>

        <div className="flex gap-5 text-sm text-muted-foreground">
          <AnchorLink href="#funciones" className="hover:text-foreground">
            Funciones
          </AnchorLink>
          <AnchorLink href="#precios" className="hover:text-foreground">
            Precios
          </AnchorLink>
          <Link href="/login" className="hover:text-foreground">
            Ingresar
          </Link>
        </div>
      </div>
    </footer>
  );
}
