import Image from "next/image";
import { cn } from "@/lib/utils";

// El isotipo de Pesito (ya trae su propio fondo), reemplaza el placeholder
// genérico que había antes en cada lugar donde aparece la marca.
export function LogoIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-icon.png"
      alt="Pesito"
      width={40}
      height={40}
      className={cn("h-9 w-9 rounded-xl", className)}
    />
  );
}
