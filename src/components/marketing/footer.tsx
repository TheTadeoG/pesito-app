import Link from "next/link";
import { Banknote } from "lucide-react";

const columns: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}[] = [
  {
    title: "Producto",
    links: [
      { label: "Funciones", href: "#funciones" },
      { label: "Cómo funciona", href: "#como-funciona" },
      { label: "Precios", href: "#precios" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { label: "Ingresar", href: "/login" },
      { label: "Crear cuenta", href: "/registro" },
    ],
  },
  {
    title: "Soporte",
    links: [
      { label: "Preguntas frecuentes", href: "#preguntas-frecuentes" },
      { label: "Contacto", href: "mailto:soporte@pesito.app", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidad", href: "/privacidad" },
      { label: "Términos", href: "/terminos" },
    ],
  },
];

function FooterLink({ label, href, external }: { label: string; href: string; external?: boolean }) {
  if (external) {
    return (
      <a href={href} className="transition-colors hover:text-foreground">
        {label}
      </a>
    );
  }
  // Los anclajes (#funciones, etc.) se linkean siempre desde "/", así
  // funcionan bien parado en cualquier página, no sólo en la landing.
  const resolvedHref = href.startsWith("#") ? `/${href}` : href;
  return (
    <Link href={resolvedHref} className="transition-colors hover:text-foreground">
      {label}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Banknote className="h-4 w-4" />
              </span>
              Pesito
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Punto de venta, inventario, clientes y caja para kioscos y almacenes. Hecho en
              Argentina para el comercio real.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {column.title}
              </p>
              <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink {...link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Pesito · Todos los derechos reservados</p>
        </div>
      </div>
    </footer>
  );
}
