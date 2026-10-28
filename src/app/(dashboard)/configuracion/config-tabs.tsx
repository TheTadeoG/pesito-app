import Link from "next/link";
import { cn } from "@/lib/utils";

export type ConfigSection = "negocio" | "facturacion" | "avisos" | "datos" | "cuenta";

const sections: { value: ConfigSection; label: string; href: string; adminOnly?: boolean }[] = [
  { value: "negocio", label: "Negocio", href: "/configuracion" },
  { value: "facturacion", label: "Facturación", href: "/configuracion?tab=facturacion", adminOnly: true },
  { value: "avisos", label: "Avisos", href: "/configuracion?tab=avisos", adminOnly: true },
  { value: "datos", label: "Tus datos", href: "/configuracion?tab=datos", adminOnly: true },
  { value: "cuenta", label: "Cuenta y seguridad", href: "/configuracion?tab=cuenta" },
];

/** Las secciones de Ajustes (una por vez): el negocio, los avisos, bajar tus datos y la cuenta con su seguridad. */
export function ConfigTabs({ active, isAdmin }: { active: ConfigSection; isAdmin: boolean }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-muted/50 p-1">
      {sections
        .filter((s) => !s.adminOnly || isAdmin)
        .map((s) => (
          <Link
            key={s.value}
            href={s.href}
            prefetch={false}
            aria-current={active === s.value ? "page" : undefined}
            className={cn(
              "inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              active === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </Link>
        ))}
    </div>
  );
}
