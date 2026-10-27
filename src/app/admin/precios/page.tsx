import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { MarketTester } from "./tester";

export const maxDuration = 60;

export default async function PreciosAdminPage() {
  await requirePlatformAdmin();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a /admin
        </Link>
        <h1 className="mt-2 text-xl font-bold text-foreground">Precios de supermercados</h1>
        <p className="text-sm text-muted-foreground">
          Una prueba chica contra Carrefour, Jumbo, Disco y Vea: baja unas pocas páginas, guarda lo que sirve y
          muestra qué respondió cada uno. Sirve para confirmar que la recolección mensual va a andar.
        </p>
      </div>
      <MarketTester />
    </div>
  );
}
